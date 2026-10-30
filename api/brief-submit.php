<?php

declare(strict_types=1);

require __DIR__ . '/../lib/brief-bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Method Not Allowed';
    exit;
}

$config = brief_load_config();
$maxUpload = (int) ($config['max_upload_bytes'] ?? 8 * 1024 * 1024);

$phone = brief_normalize_phone((string) ($_POST['phone'] ?? ''));

if ($phone === null) {
    brief_redirect_home('brief=error&reason=phone');
}

if (($_POST['consent'] ?? '') !== 'yes') {
    brief_redirect_home('brief=error&reason=consent');
}

$material = (string) ($_POST['material'] ?? '');

if (!in_array($material, ['quartz', 'acrylic', 'consult'], true)) {
    brief_redirect_home('brief=error&reason=material');
}

$name = brief_sanitize_text((string) ($_POST['name'] ?? ''), 120);
$project = brief_sanitize_text((string) ($_POST['project'] ?? ''), 4000);

$dataDir = brief_data_dir();

if (!is_dir($dataDir) && !mkdir($dataDir, 0750, true) && !is_dir($dataDir)) {
    brief_redirect_home('brief=error&reason=storage');
}

$idBytes = random_bytes(16);
$idBytes[6] = chr((ord($idBytes[6]) & 0x0f) | 0x40);
$idBytes[8] = chr((ord($idBytes[8]) & 0x3f) | 0x80);
$idHex = bin2hex($idBytes);
$id = substr($idHex, 0, 8) . '-' . substr($idHex, 8, 4) . '-' . substr($idHex, 12, 4) . '-' . substr($idHex, 16, 4) . '-' . substr($idHex, 20, 12);

$entryDir = $dataDir . '/' . $id;

if (!mkdir($entryDir, 0750, true) && !is_dir($entryDir)) {
    brief_redirect_home('brief=error&reason=storage');
}

$fileName = null;

if (isset($_FILES['plan']) && is_array($_FILES['plan']) && ($_FILES['plan']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    $upload = $_FILES['plan'];

    if (($upload['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        brief_redirect_home('brief=error&reason=file');
    }

    if (($upload['size'] ?? 0) > $maxUpload) {
        brief_redirect_home('brief=error&reason=filesize');
    }

    $original = (string) ($upload['name'] ?? '');
    $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));

    if (!in_array($ext, ['pdf', 'jpg', 'jpeg', 'png'], true)) {
        brief_redirect_home('brief=error&reason=filetype');
    }

    $storedExt = $ext === 'jpeg' ? 'jpg' : $ext;
    $storedName = 'plan.' . $storedExt;
    $target = $entryDir . '/' . $storedName;

    if (!move_uploaded_file((string) $upload['tmp_name'], $target)) {
        brief_redirect_home('brief=error&reason=file');
    }

    @chmod($target, 0640);
    $fileName = $storedName;
}

$meta = [
    'id' => $id,
    'createdAt' => gmdate('c'),
    'name' => $name,
    'phone' => $phone,
    'material' => $material,
    'project' => $project,
    'file' => $fileName,
];

$metaPath = $entryDir . '/meta.json';

if (file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) === false) {
    brief_redirect_home('brief=error&reason=storage');
}

@chmod($metaPath, 0640);

brief_redirect_home('brief=sent');
