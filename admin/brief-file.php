<?php

declare(strict_types=1);

require __DIR__ . '/../lib/brief-bootstrap.php';

brief_require_admin_auth();

$id = (string) ($_GET['id'] ?? '');

if (!brief_is_valid_uuid($id)) {
    http_response_code(404);
    exit;
}

$meta = brief_read_meta($id);

if ($meta === null || empty($meta['file'])) {
    http_response_code(404);
    exit;
}

$fileName = basename((string) $meta['file']);
$path = brief_data_dir() . '/' . $id . '/' . $fileName;

if (!is_file($path)) {
    http_response_code(404);
    exit;
}

$ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
$types = [
    'pdf' => 'application/pdf',
    'jpg' => 'image/jpeg',
    'png' => 'image/png',
];

header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . (string) filesize($path));
header('Content-Disposition: attachment; filename="' . rawurlencode($fileName) . '"');
header('X-Content-Type-Options: nosniff');

readfile($path);
