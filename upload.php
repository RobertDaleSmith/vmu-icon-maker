<?php
// Disable CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Check if a file was uploaded
    if (isset($_FILES['zipFile']) && $_FILES['zipFile']['error'] === UPLOAD_ERR_OK) {
        // Check file size (50KB limit)
        if ($_FILES['zipFile']['size'] > 51200) { // 50KB = 50 * 1024 bytes
            echo 'File size exceeds the 50KB limit.';
            exit;
        }

        $uploadDir = 'uploads/'; // Directory where files will be saved
        $originalName = pathinfo($_FILES['zipFile']['name'], PATHINFO_FILENAME);
        $extension = pathinfo($_FILES['zipFile']['name'], PATHINFO_EXTENSION);
        $uploadFile = $uploadDir . $_FILES['zipFile']['name'];

        // Ensure the upload directory exists
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        // Check if file exists and append a number if necessary
        $counter = 1;
        while (file_exists($uploadFile)) {
            $uploadFile = $uploadDir . $originalName . '_' . $counter . '.' . $extension;
            $counter++;
        }

        // Move the uploaded file to the desired directory
        if (move_uploaded_file($_FILES['zipFile']['tmp_name'], $uploadFile)) {
            echo 'File successfully uploaded as ' . basename($uploadFile);
        } else {
            echo 'Failed to move uploaded file.';
        }
    } else {
        echo 'No file uploaded or upload error.';
    }
} else {
    echo 'Invalid request method.';
}
?>
