# Flutter App to Admin Dashboard Integration Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Supabase Cloud                         │
│  (Authentication, Database, Real-time Subscriptions)    │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   ┌─────────┐ ┌─────────┐ ┌────────────┐
   │ Flutter │ │ Flutter │ │   NestJS   │
   │  Mobile │ │   Web   │ │  Backend   │
   │   App   │ │ Admin   │ │   API      │
   └─────────┘ └─────────┘ └────────────┘
```

---

## Communication Flow

### 1. Authentication Flow

```
User (Mobile/Web) 
    │
    ├─ Register/Login via Supabase Auth
    │
    ▼
Supabase Auth Service
    │
    ├─ Generates JWT Token
    │
    ▼
Store Token (Secure Storage on mobile, Local Storage on web)
    │
    ├─ Include in API calls: Authorization: Bearer <token>
    │
    ▼
Backend Verifies Token
    │
    ├─ Check admin role (for admin dashboard)
    │
    ▼
Grant Access to Protected Endpoints
```

### 2. Report Creation & Sync

```
Mobile App (User creates report offline)
    │
    ├─ Save report to local database
    │
    ▼
User connects to internet
    │
    ├─ Upload image to Supabase Storage
    │
    ▼
Create report via API POST /reports
    │
    ├─ Backend stores in community_reports table
    │
    ▼
Real-time Update (Supabase realtime)
    │
    ├─ Web Dashboard receives update
    │
    ▼
Admin Dashboard shows new reports
```

### 3. Data Flow to Admin Dashboard

```
Community Reports (Supabase DB)
    │
    ├─ Query via API: GET /admin/reports
    │
    ▼
NestJS Backend (with pagination, filtering)
    │
    ├─ Returns filtered/sorted data
    │
    ▼
Web Dashboard (real-time updates via WebSocket)
    │
    ├─ Updates charts, tables, heatmap
    │
    ▼
Admin Reviews & Approves Reports
```

---

## Step-by-Step Implementation

### Step 1: Flutter Mobile App - Authentication

**File: `lib/screens/auth/login_screen.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authService = AuthService();
  bool _isLoading = false;

  Future<void> _login() async {
    setState(() => _isLoading = true);
    
    final result = await _authService.login(
      email: _emailController.text,
      password: _passwordController.text,
    );

    setState(() => _isLoading = false);

    if (result['success']) {
      if (mounted) {
        Navigator.of(context).pushReplacementNamed('/home');
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Login failed: ${result['error']}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _login,
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text('Login'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
```

### Step 2: Flutter Mobile App - Report Creation

**File: `lib/screens/report/create_report_screen.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:location/location.dart';
import '../../services/api_service.dart';

class CreateReportScreen extends StatefulWidget {
  const CreateReportScreen({Key? key}) : super(key: key);

  @override
  _CreateReportScreenState createState() => _CreateReportScreenState();
}

class _CreateReportScreenState extends State<CreateReportScreen> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  String? _selectedViolationType;
  String? _imagePath;
  bool _isLoading = false;
  LocationData? _currentLocation;
  final _location = Location();

  final List<String> _violationTypes = [
    'speeding',
    'parking',
    'running_red_light',
    'no_helmet',
    'phone_while_driving',
    'other',
  ];

  @override
  void initState() {
    super.initState();
    _getCurrentLocation();
  }

  Future<void> _getCurrentLocation() async {
    try {
      final locData = await _location.getLocation();
      setState(() => _currentLocation = locData);
    } catch (e) {
      print('Error getting location: $e');
    }
  }

  Future<void> _pickImage() async {
    try {
      final image = await ImagePicker().pickImage(source: ImageSource.camera);
      if (image != null) {
        setState(() => _imagePath = image.path);
      }
    } catch (e) {
      print('Error picking image: $e');
    }
  }

  Future<void> _submitReport() async {
    if (_nameController.text.isEmpty || _selectedViolationType == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill all fields')),
      );
      return;
    }

    if (_currentLocation == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location not available')),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      String? imageUrl;
      if (_imagePath != null) {
        imageUrl = await ApiService.uploadImage(_imagePath!);
      }

      final report = await ApiService.createReport(
        name: _nameController.text,
        latitude: _currentLocation!.latitude!,
        longitude: _currentLocation!.longitude!,
        violationType: _selectedViolationType!,
        description: _descriptionController.text,
        imageUrl: imageUrl,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report created successfully')),
        );
        Navigator.of(context).pop(report);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Report Violation')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(
                labelText: 'Violation Name',
                hintText: 'e.g., Speeding on Main St',
              ),
            ),
            const SizedBox(height: 16),
            DropdownButton<String>(
              isExpanded: true,
              value: _selectedViolationType,
              hint: const Text('Select Violation Type'),
              items: _violationTypes.map((type) {
                return DropdownMenuItem(
                  value: type,
                  child: Text(type),
                );
              }).toList(),
              onChanged: (value) {
                setState(() => _selectedViolationType = value);
              },
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(
                labelText: 'Description',
                hintText: 'Provide details about the violation',
              ),
              maxLines: 4,
            ),
            const SizedBox(height: 16),
            if (_imagePath != null)
              Container(
                height: 200,
                width: double.infinity,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Image.file(
                  File(_imagePath!),
                  fit: BoxFit.cover,
                ),
              )
            else
              GestureDetector(
                onTap: _pickImage,
                child: Container(
                  height: 200,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Icon(Icons.camera_alt, size: 50),
                  ),
                ),
              ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _isLoading ? null : _submitReport,
              child: _isLoading
                  ? const CircularProgressIndicator()
                  : const Text('Submit Report'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }
}
```

### Step 3: Flutter Web Admin Dashboard

**File: `lib/screens/admin_dashboard.dart`**

```dart
import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/admin_api_service.dart';

class AdminDashboard extends StatefulWidget {
  const AdminDashboard({Key? key}) : super(key: key);

  @override
  _AdminDashboardState createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
  Map<String, dynamic>? _stats;
  List<dynamic>? _reports;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDashboardData();
  }

  Future<void> _loadDashboardData() async {
    try {
      final stats = await AdminApiService.getDashboardStats();
      final reports = await AdminApiService.getReports();
      
      setState(() {
        _stats = stats;
        _reports = reports['reports'];
        _isLoading = false;
      });
    } catch (e) {
      print('Error loading dashboard: $e');
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sentinel Admin Dashboard'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Key Metrics Row
            GridView.count(
              crossAxisCount: 4,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 16,
              crossAxisSpacing: 16,
              children: [
                _buildStatCard(
                  'Total Users',
                  _stats?['totalUsers'].toString() ?? '0',
                  Colors.blue,
                ),
                _buildStatCard(
                  'Total Reports',
                  _stats?['totalReports'].toString() ?? '0',
                  Colors.orange,
                ),
                _buildStatCard(
                  'Verified',
                  _stats?['verifiedReports'].toString() ?? '0',
                  Colors.green,
                ),
                _buildStatCard(
                  'Pending',
                  _stats?['pendingReports'].toString() ?? '0',
                  Colors.yellow,
                ),
              ],
            ),
            const SizedBox(height: 32),
            
            // Violation Type Chart
            Text(
              'Violation Types Breakdown',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            _buildViolationChart(),
            const SizedBox(height: 32),
            
            // Recent Reports Table
            Text(
              'Recent Reports',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 16),
            _buildReportsTable(),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildViolationChart() {
    final Map<String, int> violations = _stats?['violationTypeBreakdown'] ?? {};
    
    return Container(
      height: 300,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: PieChart(
        PieChartData(
          sections: violations.entries.map((e) {
            return PieChartSectionData(
              value: e.value.toDouble(),
              title: e.key,
              radius: 100,
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildReportsTable() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: const [
          DataColumn(label: Text('ID')),
          DataColumn(label: Text('Type')),
          DataColumn(label: Text('Status')),
          DataColumn(label: Text('Created')),
          DataColumn(label: Text('Action')),
        ],
        rows: (_reports ?? []).take(10).map((report) {
          return DataRow(
            cells: [
              DataCell(Text(report['id'].substring(0, 8))),
              DataCell(Text(report['violation_type'] ?? 'N/A')),
              DataCell(
                Chip(
                  label: Text(report['status'] ?? 'pending'),
                  backgroundColor: report['status'] == 'verified'
                      ? Colors.green.shade100
                      : Colors.yellow.shade100,
                ),
              ),
              DataCell(Text(report['created_at'].toString().split('T')[0])),
              DataCell(
                PopupMenuButton(
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      child: const Text('Verify'),
                      onTap: () => _updateReportStatus(
                        report['id'],
                        'verified',
                      ),
                    ),
                    PopupMenuItem(
                      child: const Text('Reject'),
                      onTap: () => _updateReportStatus(
                        report['id'],
                        'rejected',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        }).toList(),
      ),
    );
  }

  Future<void> _updateReportStatus(String reportId, String status) async {
    try {
      await AdminApiService.updateReportStatus(
        reportId: reportId,
        status: status,
      );
      _loadDashboardData();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Report $status')),
      );
    } catch (e) {
      print('Error: $e');
    }
  }
}
```

---

## Real-time Synchronization

### Enable Real-time in Admin Dashboard

```dart
import 'package:supabase_flutter/supabase_flutter.dart';

class AdminDashboard extends StatefulWidget {
  @override
  _AdminDashboardState createState() => _AdminDashboardState();
}

class _AdminDashboardState extends State<AdminDashboard> {
  late RealtimeChannel _reportsChannel;

  @override
  void initState() {
    super.initState();
    _setupRealtimeListener();
  }

  void _setupRealtimeListener() {
    _reportsChannel = Supabase.instance.client
        .channel('public:community_reports')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'community_reports',
          callback: (payload) {
            print('Report update: ${payload.eventType}');
            _loadDashboardData(); // Refresh data
          },
        )
        .subscribe();
  }

  @override
  void dispose() {
    _reportsChannel.unsubscribe();
    super.dispose();
  }
}
```

---

## Testing the Integration

### 1. Test Mobile App Report Creation

```bash
1. Start backend: npm run start:dev
2. Start mobile app: flutter run
3. Login with test account
4. Create a report
5. Check backend logs for API call
6. Verify report appears in Supabase
```

### 2. Test Admin Dashboard

```bash
1. Start web dashboard: flutter run -d chrome
2. Login with admin account
3. Verify dashboard loads stats
4. Verify real-time updates when mobile app creates report
5. Test report status update
```

### 3. Test Offline Sync

```dart
// In mobile app - implement offline queue
class OfflineReportQueue {
  final box = Hive.box('reports');
  
  Future<void> addOfflineReport(Map<String, dynamic> report) async {
    report['synced'] = false;
    await box.add(report);
  }
  
  Future<void> syncOfflineReports() async {
    final reports = box.values.where((r) => !r['synced']).toList();
    for (var report in reports) {
      try {
        await ApiService.createReport(...);
        report['synced'] = true;
      } catch (e) {
        print('Sync failed: $e');
      }
    }
  }
}
```

---

## Debugging

### Check API Connection
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/reports
```

### View Backend Logs
```bash
# Terminal 1 - Backend
npm run start:dev

# Check for: POST /reports 201 Created
# Check for: GET /reports 200 OK
```

### Monitor Supabase
- Go to Supabase Dashboard
- Check **Editor** → tables for data
- Check **Logs** for queries
- Enable **Realtime** for tables

### Flutter Debug
```dart
// Enable http logging
import 'package:http/http.dart' as http;

final client = http.Client();
// Log all requests
client.send(request).then((response) {
  print('Response: ${response.statusCode}');
});
```
