<?php

/**
 * Скопируйте на сервер:
 *   ~/domains/stone-vibe.ru/private/brief-config.php
 * chmod 600 private/brief-config.php
 *
 * Хеш пароля (в терминале на сервере):
 *   php -r "echo password_hash('ВАШ_ДЛИННЫЙ_ПАРОЛЬ', PASSWORD_DEFAULT), PHP_EOL;"
 */

return [
    'admin_user' => 'brief-admin',
    'admin_password_hash' => '$2y$10$REPLACE_WITH_password_hash_OUTPUT',
    'data_dir' => __DIR__ . '/briefs',
    'max_upload_bytes' => 8 * 1024 * 1024,
];
