<?php
// Receives icon zips exported by the maker. Only well-formed .zip files are
// accepted, they are stored under a server-chosen name, and the uploads
// directory is locked so nothing in it can be fetched or executed.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: text/plain; charset=utf-8");

const MAX_ZIP_BYTES = 51200; // 50KB
const UPLOAD_DIR = __DIR__ . '/uploads/';

function fail($code, $msg) {
    http_response_code($code);
    echo $msg;
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Invalid request method.');
}
if (!isset($_FILES['zipFile']) || $_FILES['zipFile']['error'] !== UPLOAD_ERR_OK) {
    fail(400, 'No file uploaded or upload error.');
}

$file = $_FILES['zipFile'];
if ($file['size'] > MAX_ZIP_BYTES) {
    fail(413, 'File size exceeds the 50KB limit.');
}

// Must be a real zip: check the local file header magic, not the client's name.
$fh = fopen($file['tmp_name'], 'rb');
$magic = $fh ? fread($fh, 4) : '';
if ($fh) fclose($fh);
if ($magic !== "PK\x03\x04") {
    fail(415, 'Only .zip files are accepted.');
}

if (!is_dir(UPLOAD_DIR) && !mkdir(UPLOAD_DIR, 0755, true)) {
    fail(500, 'Upload directory unavailable.');
}
// Deny all web access to stored uploads (Apache 2.2/2.4 and LiteSpeed).
$htaccess = UPLOAD_DIR . '.htaccess';
if (!file_exists($htaccess)) {
    file_put_contents($htaccess,
        "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n" .
        "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n" .
        "Options -Indexes -ExecCGI\n" .
        "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar\n" .
        "SetHandler none\n");
}

// Keep the descriptive part of the client name, but only safe characters,
// and always force the .zip extension.
$base = pathinfo(basename($file['name']), PATHINFO_FILENAME);
$base = preg_replace('/[^A-Za-z0-9_-]/', '_', $base);
$base = substr(trim($base, '_'), 0, 48);
if ($base === '') $base = 'VMU_ICONDATA';

$target = UPLOAD_DIR . $base . '.zip';
for ($n = 1; file_exists($target); $n++) {
    $target = UPLOAD_DIR . $base . '_' . $n . '.zip';
}

if (!move_uploaded_file($file['tmp_name'], $target)) {
    fail(500, 'Failed to move uploaded file.');
}
chmod($target, 0644);
echo 'File successfully uploaded as ' . basename($target);
