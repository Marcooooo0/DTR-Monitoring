<?php
// db.php - Database connection configuration
$host = 'localhost';
$dbname = 'internship-tracker';
$username = 'root'; // Laragon default
$password = '';     // Laragon default

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    // Set PDO error mode to exception for secure error handling
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode(['status' => 'error', 'message' => 'Database connection failed.']));
}
?>