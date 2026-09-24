<?php
declare(strict_types=1);

/**
 * Template for the contact form's mail settings. It carries no secret.
 *
 * Copy it to audioguia-mail.php ONE LEVEL ABOVE the site's document root, so
 * it can never be served over HTTP, and fill in the real values there:
 *
 *   production:  <folder above the audioguia.io document root>/audioguia-mail.php
 *   local XAMPP: this project's root, when build/ is the document root
 *
 * Or put it anywhere and point the AUDIOGUIA_MAIL_CONFIG environment variable
 * at it. Never commit the real file; .gitignore and .deployignore exclude it.
 */

return [
    'host'       => 'smtp.dreamhost.com',
    'port'       => 587,
    'username'   => 'REEMPLAZAR@audioguia.io',
    'password'   => 'REEMPLAZAR_FUERA_DEL_REPO',
    'from_email' => 'REEMPLAZAR@audioguia.io',
    'from_name'  => 'audioguia.io',
    'to_email'   => 'REEMPLAZAR_DESTINO@example.com',
    'to_name'    => 'audioguia.io',
    'timeout'    => 30,
];
