import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

@Injectable()
export class ClusteringService implements OnModuleInit {
  private readonly logger = new Logger(ClusteringService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  onModuleInit() {
    // Run scheduled clustering every 1 hour (3600000 ms)
    setInterval(() => {
      this.logger.log('Starting scheduled DBSCAN clustering...');
      this.runClustering().catch((err) => {
        this.logger.error('Error running scheduled DBSCAN clustering', err);
      });
    }, 3600000);

    // Also run 10 seconds after startup
    setTimeout(() => {
      this.logger.log('Starting initial startup DBSCAN clustering...');
      this.runClustering().catch((err) => {
        this.logger.error('Error running initial DBSCAN clustering', err);
      });
    }, 10000);
  }

  async runClustering(): Promise<{
    processed: number;
    approved: number;
    clustersCount: number;
  }> {
    const client = this.supabaseService.getAdminClient();
    this.logger.log('Fetching pending community reports for clustering...');

    const { data: reports, error: fetchError } = await client
      .from('community_reports')
      .select('*')
      .eq('status', 'pending');

    if (fetchError) {
      this.logger.error(`Failed to fetch pending reports: ${fetchError.message}`);
      throw new Error(fetchError.message);
    }

    if (!reports || reports.length === 0) {
      this.logger.log('No pending community reports found to cluster.');
      return { processed: 0, approved: 0, clustersCount: 0 };
    }

    this.logger.log(`Found ${reports.length} pending reports. Grouping by violation type...`);

    // Group reports by violation type (we cluster signs of the same type together)
    const groups: Record<string, any[]> = {};
    for (const report of reports) {
      const type = report.violation_type || 'other';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(report);
    }

    const eps = 15; // 15 meters radius
    const minPts = 3; // Minimum 3 reports/upvotes to form a cluster
    let totalApproved = 0;
    let totalClustersCount = 0;

    for (const [type, typeReports] of Object.entries(groups)) {
      this.logger.log(`Clustering type "${type}" with ${typeReports.length} reports...`);
      const clusters = this.dbscan(typeReports, eps, minPts);
      
      this.logger.log(`Type "${type}" yielded ${clusters.length} clusters.`);
      totalClustersCount += clusters.length;

      for (const clusterIndices of clusters) {
        const clusterReports = clusterIndices.map((idx) => typeReports[idx]);
        
        // Check if there are at least 3 unique users OR total upvotes >= 3
        const uniqueUsers = new Set(clusterReports.map((r) => r.user_id));
        const totalUpvotes = clusterReports.reduce((sum, r) => sum + (r.upvotes || 0), 0) + clusterReports.length;

        if (uniqueUsers.size >= minPts || totalUpvotes >= minPts) {
          // Calculate centroid
          let sumLat = 0;
          let sumLng = 0;
          for (const r of clusterReports) {
            sumLat += r.latitude;
            sumLng += r.longitude;
          }
          const centroidLat = sumLat / clusterReports.length;
          const centroidLng = sumLng / clusterReports.length;

          this.logger.log(
            `Approving sign cluster "${type}" at centroid (${centroidLat.toFixed(5)}, ${centroidLng.toFixed(5)}) with ${clusterReports.length} reports.`,
          );

          // 1. Insert/Update approved sign
          // Check if there is already an approved sign of the same type within 15 meters of centroid
          const { data: existingSigns, error: existingError } = await client
            .from('approved_signs')
            .select('*')
            .eq('label', type);

          let matchedSign: any = null;
          if (existingSigns && existingSigns.length > 0) {
            for (const sign of existingSigns) {
              const d = getDistance(centroidLat, centroidLng, sign.latitude, sign.longitude);
              if (d <= 15) {
                matchedSign = sign;
                break;
              }
            }
          }

          let approvedSignId: string;

          if (matchedSign) {
            // Update existing approved sign
            const updatedUpvotes = (matchedSign.upvotes || 0) + totalUpvotes;
            const updatedReportsCount = (matchedSign.reports_count || 0) + clusterReports.length;

            const { data: updatedSign, error: updateError } = await client
              .from('approved_signs')
              .update({
                upvotes: updatedUpvotes,
                reports_count: updatedReportsCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', matchedSign.id)
              .select()
              .single();

            if (updateError) {
              this.logger.error(`Failed to update approved sign: ${updateError.message}`);
              continue;
            }
            approvedSignId = updatedSign.id;
          } else {
            // Create new approved sign
            const { data: newSign, error: insertError } = await client
              .from('approved_signs')
              .insert({
                label: type,
                latitude: centroidLat,
                longitude: centroidLng,
                upvotes: totalUpvotes,
                reports_count: clusterReports.length,
                status: 'approved',
              })
              .select()
              .single();

            if (insertError) {
              this.logger.error(`Failed to insert approved sign: ${insertError.message}`);
              continue;
            }
            approvedSignId = newSign.id;
          }

          // 2. Mark all reports in this cluster as verified
          const reportIds = clusterReports.map((r) => r.id);
          const { error: markError } = await client
            .from('community_reports')
            .update({ status: 'verified', is_verified: true })
            .in('id', reportIds);

          if (markError) {
            this.logger.error(`Failed to verify reports in cluster: ${markError.message}`);
          } else {
            totalApproved += clusterReports.length;
          }
        } else {
          this.logger.log(`Cluster of type "${type}" has insufficient density/votes. Keeping pending.`);
        }
      }

      // Handle noise reports
      // If a report is noise (not in any cluster) and is older than 7 days, we can mark it as rejected to clean database
      const clusteredIndices = new Set(clusters.flat());
      const noiseReports = typeReports.filter((_, idx) => !clusteredIndices.has(idx));
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const oldNoiseIds: string[] = [];
      for (const r of noiseReports) {
        if (new Date(r.created_at) < sevenDaysAgo) {
          oldNoiseIds.push(r.id);
        }
      }

      if (oldNoiseIds.length > 0) {
        this.logger.log(`Marking ${oldNoiseIds.length} old noise reports as rejected.`);
        await client
          .from('community_reports')
          .update({ status: 'rejected' })
          .in('id', oldNoiseIds);
      }
    }

    this.logger.log(
      `DBSCAN clustering complete. Processed ${reports.length} pending reports. Approved ${totalApproved} reports into ${totalClustersCount} clusters.`,
    );

    return {
      processed: reports.length,
      approved: totalApproved,
      clustersCount: totalClustersCount,
    };
  }

  private dbscan(points: any[], eps: number, minPts: number): number[][] {
    const visited = new Set<number>();
    const clusters: number[][] = [];

    const getNeighbors = (idx: number): number[] => {
      const neighbors: number[] = [];
      const p1 = points[idx];
      for (let i = 0; i < points.length; i++) {
        const p2 = points[i];
        const dist = getDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
        if (dist <= eps) {
          neighbors.push(i);
        }
      }
      return neighbors;
    };

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;
      visited.add(i);

      const neighbors = getNeighbors(i);
      
      // Calculate total weight of neighbors (upvotes + reports) to check density
      const totalWeight = neighbors.reduce((sum, idx) => {
        return sum + (points[idx].upvotes || 0) + 1;
      }, 0);

      if (totalWeight < minPts) {
        // Mark as noise (for now)
      } else {
        const cluster: number[] = [];
        clusters.push(cluster);

        // Expand cluster
        const queue = [...neighbors];
        const clusterSet = new Set<number>(queue);

        for (let j = 0; j < queue.length; j++) {
          const currentIdx = queue[j];
          if (!visited.has(currentIdx)) {
            visited.add(currentIdx);
            const currentNeighbors = getNeighbors(currentIdx);
            const currentWeight = currentNeighbors.reduce((sum, idx) => {
              return sum + (points[idx].upvotes || 0) + 1;
            }, 0);

            if (currentWeight >= minPts) {
              for (const n of currentNeighbors) {
                if (!clusterSet.has(n)) {
                  queue.push(n);
                  clusterSet.add(n);
                }
              }
            }
          }
          cluster.push(currentIdx);
        }
      }
    }

    return clusters;
  }
}
