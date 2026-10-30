<?php

declare(strict_types=1);

function brief_domain_root(): string
{
    return dirname(dirname(__DIR__));
}

function brief_config_path(): string
{
    return brief_domain_root() . '/private/brief-config.php';
}

function brief_load_config(): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }

    $path = brief_config_path();

    if (!is_file($path)) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Сервис заявок не настроен.';
        exit;
    }

    $loaded = require $path;

    if (!is_array($loaded)) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Некорректный конфиг заявок.';
        exit;
    }

    $config = $loaded;

    return $config;
}

function brief_data_dir(): string
{
    $config = brief_load_config();
    $dir = $config['data_dir'] ?? (brief_domain_root() . '/private/briefs');

    return rtrim($dir, '/');
}

function brief_material_label(string $value): string
{
    $map = [
        'quartz' => 'Кварц',
        'acrylic' => 'Акрил',
        'consult' => 'Нужна консультация',
    ];

    return $map[$value] ?? $value;
}

function brief_require_admin_auth(): void
{
    $config = brief_load_config();
    $user = $config['admin_user'] ?? '';
    $hash = $config['admin_password_hash'] ?? '';

    if ($user === '' || $hash === '') {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Админка заявок не настроена.';
        exit;
    }

    $givenUser = $_SERVER['PHP_AUTH_USER'] ?? '';
    $givenPass = $_SERVER['PHP_AUTH_PW'] ?? '';

    if ($givenUser === '' || $givenPass === '' || $givenUser !== $user || !password_verify($givenPass, $hash)) {
        header('WWW-Authenticate: Basic realm="Stone Vibe Briefs"');
        header('HTTP/1.0 401 Unauthorized');
        header('Content-Type: text/plain; charset=utf-8');
        echo 'Требуется авторизация';
        exit;
    }
}

function brief_redirect_home(string $query): never
{
    header('Location: /index.html?' . $query . '#brief', true, 303);
    exit;
}

function brief_normalize_phone(string $raw): ?string
{
    $digits = preg_replace('/\D/', '', $raw);

    if ($digits === null || strlen($digits) !== 11 || $digits[0] !== '7') {
        return null;
    }

    return '+' . $digits;
}

function brief_sanitize_text(string $value, int $maxLen): string
{
    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');

    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $maxLen);
    }

    return substr($value, 0, $maxLen);
}

function brief_is_valid_uuid(string $id): bool
{
    return (bool) preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i', $id);
}

function brief_read_meta(string $id): ?array
{
    if (!brief_is_valid_uuid($id)) {
        return null;
    }

    $path = brief_data_dir() . '/' . $id . '/meta.json';

    if (!is_file($path)) {
        return null;
    }

    $data = json_decode((string) file_get_contents($path), true);

    return is_array($data) ? $data : null;
}
