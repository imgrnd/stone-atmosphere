<?php

declare(strict_types=1);

require __DIR__ . '/../lib/brief-bootstrap.php';

brief_require_admin_auth();

$dataDir = brief_data_dir();
$entries = [];

if (is_dir($dataDir)) {
    foreach (scandir($dataDir) ?: [] as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $meta = brief_read_meta($item);

        if ($meta !== null) {
            $entries[] = $meta;
        }
    }
}

usort($entries, static function (array $a, array $b): int {
    return strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? '');
});

$count = count($entries);
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Заявки — служебная</title>
  <link rel="stylesheet" href="/styles.css?v=140">
</head>
<body class="brief-admin-page">
  <main class="brief-admin">
    <header class="brief-admin__head">
      <p class="brief-admin__eyebrow">Служебная страница</p>
      <h1 class="brief-admin__title">Заявки с сайта</h1>
      <p class="brief-admin__lead">Форма «Каким будет ваш камень?» на главной. Всего: <?php echo (int) $count; ?></p>
    </header>

    <?php if ($count === 0) : ?>
      <p class="brief-admin__empty">Пока нет заявок.</p>
    <?php else : ?>
      <div class="brief-admin__table-wrap">
        <table class="brief-admin__table">
          <thead>
            <tr>
              <th scope="col">Дата</th>
              <th scope="col">Имя</th>
              <th scope="col">Телефон</th>
              <th scope="col">Материал</th>
              <th scope="col">Проект</th>
              <th scope="col">Файл</th>
            </tr>
          </thead>
          <tbody>
            <?php foreach ($entries as $entry) :
              $phoneRaw = (string) ($entry['phone'] ?? '');
              $phone = htmlspecialchars($phoneRaw, ENT_QUOTES, 'UTF-8');
              $project = htmlspecialchars((string) ($entry['project'] ?? ''), ENT_QUOTES, 'UTF-8');
              $name = htmlspecialchars((string) ($entry['name'] ?? '—'), ENT_QUOTES, 'UTF-8');
              $material = htmlspecialchars(brief_material_label((string) ($entry['material'] ?? '')), ENT_QUOTES, 'UTF-8');
              $created = htmlspecialchars((string) ($entry['createdAt'] ?? ''), ENT_QUOTES, 'UTF-8');
              $id = htmlspecialchars((string) ($entry['id'] ?? ''), ENT_QUOTES, 'UTF-8');
              ?>
            <tr>
              <td class="brief-admin__date"><time datetime="<?php echo $created; ?>"><?php echo $created; ?></time></td>
              <td><?php echo $name !== '' ? $name : '—'; ?></td>
              <td><a href="tel:<?php echo rawurlencode($phoneRaw); ?>"><?php echo $phone; ?></a></td>
              <td><?php echo $material; ?></td>
              <td class="brief-admin__project"><?php echo $project !== '' ? $project : '—'; ?></td>
              <td>
                <?php if (!empty($entry['file'])) : ?>
                  <a href="/admin/brief-file.php?id=<?php echo urlencode($id); ?>">Скачать</a>
                <?php else : ?>
                  —
                <?php endif; ?>
              </td>
            </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    <?php endif; ?>
  </main>
</body>
</html>
