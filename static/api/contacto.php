<?php
declare(strict_types=1);

/**
 * Contact form endpoint. Takes a JSON POST from /contacto and sends it as an
 * email through the account in the external mail config.
 *
 * Every reply is JSON: { "ok": true } or { "ok": false, "error": "<text>" }.
 * The error text is always generic and in Spanish, for the visitor. The
 * technical detail goes only to the server log.
 */

require __DIR__ . '/_smtp.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

const MAX_BODY_BYTES = 20000;
const LIMITS = ['nombre' => 100, 'email' => 254, 'asunto' => 150, 'mensaje' => 5000];
/** Messages allowed per address in RATE_WINDOW seconds. */
const RATE_MAX = 5;
const RATE_WINDOW = 3600;
/** A person cannot fill the form faster than this, in seconds. */
const MIN_FILL_SECONDS = 3;

/** @param array<string, mixed> $data */
function reply(int $status, array $data): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $status, string $message): never
{
    reply($status, ['ok' => false, 'error' => $message]);
}

/**
 * Counts messages per IP address in a small file in the system temp folder.
 * The address is stored hashed. If the folder cannot be written, the limit is
 * skipped rather than blocking every visitor.
 */
function rate_limited(string $ip): bool
{
    $dir = sys_get_temp_dir() . '/audioguia-contacto';
    if (!is_dir($dir) && !@mkdir($dir, 0700, true)) {
        return false;
    }
    $file = $dir . '/' . hash('sha256', 'audioguia|' . $ip) . '.json';
    $handle = @fopen($file, 'c+');
    if ($handle === false) {
        return false;
    }
    try {
        flock($handle, LOCK_EX);
        $now = time();
        $raw = stream_get_contents($handle);
        $times = is_string($raw) ? json_decode($raw, true) : null;
        $times = array_values(array_filter(
            is_array($times) ? $times : [],
            static fn ($t): bool => is_int($t) && $t > $now - RATE_WINDOW
        ));
        if (count($times) >= RATE_MAX) {
            return true;
        }
        $times[] = $now;
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) json_encode($times));
        return false;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'Método no permitido.');
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if ($raw === false || strlen($raw) > MAX_BODY_BYTES) {
    fail(413, 'El mensaje es demasiado largo.');
}

$contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
if (str_starts_with($contentType, 'application/json')) {
    $input = json_decode($raw, true);
} else {
    parse_str($raw, $input);
}
if (!is_array($input)) {
    fail(400, 'No pudimos leer el formulario. Probá de nuevo.');
}

// Honeypot: a field people never see. A bot that fills it gets the same
// answer as a person, so it has nothing to learn from.
$trap = $input['sitio_web'] ?? '';
if (!is_string($trap) || $trap !== '') {
    reply(200, ['ok' => true]);
}

$elapsed = $input['tiempo'] ?? null;
if (is_int($elapsed) && $elapsed < MIN_FILL_SECONDS * 1000) {
    reply(200, ['ok' => true]);
}

$fields = [];
foreach (LIMITS as $name => $max) {
    $value = $input[$name] ?? '';
    if (!is_string($value)) {
        fail(422, 'Revisá los datos del formulario.');
    }
    $value = trim($value);
    if ($value === '') {
        fail(422, 'Completá todos los campos.');
    }
    if (mb_strlen($value, 'UTF-8') > $max) {
        fail(422, 'Algún campo es demasiado largo.');
    }
    if (!mb_check_encoding($value, 'UTF-8')) {
        fail(422, 'Revisá los datos del formulario.');
    }
    $fields[$name] = $value;
}

// One line fields must stay on one line, or they could add mail headers.
foreach (['nombre', 'email', 'asunto'] as $name) {
    if (preg_match('/[\r\n\x00-\x1F\x7F]/', $fields[$name]) === 1) {
        fail(422, 'Revisá los datos del formulario.');
    }
}
if (filter_var($fields['email'], FILTER_VALIDATE_EMAIL) === false) {
    fail(422, 'El email no parece válido.');
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
if (rate_limited($ip)) {
    fail(429, 'Recibimos varios mensajes seguidos desde tu conexión. Probá de nuevo en una hora.');
}

$subject = '[audioguia.io] ' . $fields['asunto'];
$body = "Mensaje enviado desde el formulario de contacto de audioguia.io\n\n"
    . 'Nombre: ' . $fields['nombre'] . "\n"
    . 'Email: ' . $fields['email'] . "\n"
    . 'Asunto: ' . $fields['asunto'] . "\n\n"
    . $fields['mensaje'] . "\n";

try {
    $config = audioguia_mail_config();
    smtp_send($config, $subject, $body, $fields['email'], $fields['nombre']);
} catch (Throwable $e) {
    // Log the technical reason only. Never the password, never the message.
    error_log('[audioguia contacto] ' . get_class($e) . ': ' . $e->getMessage());
    fail(502, 'No pudimos enviar el mensaje. Probá de nuevo más tarde.');
}

reply(200, ['ok' => true]);
