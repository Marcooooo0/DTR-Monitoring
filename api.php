<?php
// api.php - Backend processing
require_once 'db.php';
date_default_timezone_set('Asia/Manila');

// Prevent PHP warnings from breaking JSON response
error_reporting(0); 
ob_start();

$action = $_GET['action'] ?? '';
$today = date('Y-m-d');
$current_time = date('H:i:s');

// FETCH ALL DATA
if ($action === 'fetch') {
    // Fetch Attendance
    $stmt = $pdo->query("SELECT * FROM attendance_log ORDER BY date_of_attendance DESC");
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch Overtime
    $stmtOT = $pdo->query("SELECT * FROM overtime_logs ORDER BY date_of_ot DESC");
    $ot_logs = $stmtOT->fetchAll(PDO::FETCH_ASSOC);

    // Calculations
    $total_rendered = 0;
    foreach ($logs as $log) {
        $total_rendered += (float)$log['regular_hours'];
    }

    $total_ot = 0;
    foreach ($ot_logs as $ot) {
        $total_ot += (float)$ot['hours_rendered'];
    }

    // Determine Today's Status for the Time Clock
    $stmtToday = $pdo->prepare("SELECT * FROM attendance_log WHERE date_of_attendance = ?");
    $stmtToday->execute([$today]);
    $today_log = $stmtToday->fetch(PDO::FETCH_ASSOC);

    $today_status = 'not_started'; // Default
    if ($today_log) {
        if ($today_log['time_out'] === null) {
            $today_status = 'active'; // Clocked in, not out
        } else {
            $today_status = 'completed'; // Clocked out already
        }
    }

    ob_clean(); // Clear any hidden errors
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'success',
        'logs' => $logs,
        'ot_logs' => $ot_logs,
        'total_rendered' => $total_rendered,
        'total_ot' => $total_ot,
        'today_status' => $today_status,
        'active_session' => $today_log,
        'server_time' => date('h:i A')
    ]);
    exit;
}

// TIME IN
if ($action === 'time_in' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $check = $pdo->prepare("SELECT id FROM attendance_log WHERE date_of_attendance = ?");
    $check->execute([$today]);
    
    if ($check->rowCount() > 0) {
        ob_clean(); header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => 'You have already timed in today.']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO attendance_log (date_of_attendance, time_in) VALUES (?, ?)");
    $stmt->execute([$today, $current_time]);
    
    ob_clean(); header('Content-Type: application/json');
    echo json_encode(['status' => 'success', 'message' => 'Timed In Successfully!']);
    exit;
}

// TIME OUT & CALCULATE HOURS
if ($action === 'time_out' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $stmt = $pdo->prepare("SELECT * FROM attendance_log WHERE date_of_attendance = ? AND time_out IS NULL");
    $stmt->execute([$today]);
    $log = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$log) {
        ob_clean(); header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => 'No active Time In found for today.']);
        exit;
    }

    // Calculate hours worked
    $time_in_stamp = strtotime($log['time_in']);
    $time_out_stamp = strtotime($current_time);
    $hours_worked = ($time_out_stamp - $time_in_stamp) / 3600;

    // Break deduction and caps
    if ($hours_worked > 5) { $hours_worked -= 1; }
    if ($hours_worked > 8) { $hours_worked = 8; }
    if ($hours_worked < 0) { $hours_worked = 0; }

    $update = $pdo->prepare("UPDATE attendance_log SET time_out = ?, regular_hours = ? WHERE id = ?");
    $update->execute([$current_time, round($hours_worked, 2), $log['id']]);
    
    ob_clean(); header('Content-Type: application/json');
    echo json_encode(['status' => 'success', 'message' => 'Timed Out Successfully!']);
    exit;
}

// DIRECT ADD OVERTIME
if ($action === 'add_ot' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $date = $_POST['ot_date'] ?? '';
    $start = $_POST['ot_start'] ?? '';
    $end = $_POST['ot_end'] ?? '';

    if (empty($date) || empty($start) || empty($end)) {
        ob_clean(); header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => 'All fields are required.']);
        exit;
    }

    $start_stamp = strtotime("$date $start");
    $end_stamp = strtotime("$date $end");

    if ($end_stamp <= $start_stamp) {
        ob_clean(); header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'message' => 'End time must be after Start time.']);
        exit;
    }

    $hours_rendered = round(($end_stamp - $start_stamp) / 3600, 2);

    $stmt = $pdo->prepare("INSERT INTO overtime_logs (date_of_ot, time_start, time_end, hours_rendered) VALUES (?, ?, ?, ?)");
    $stmt->execute([$date, $start, $end, $hours_rendered]);
    
    ob_clean(); header('Content-Type: application/json');
    echo json_encode(['status' => 'success', 'message' => 'Overtime logged successfully!']);
    exit;
}

ob_clean(); header('Content-Type: application/json');
echo json_encode(['status' => 'error', 'message' => 'Invalid action.']);
?>