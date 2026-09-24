<?php
declare(strict_types=1);

/**
 * Small SMTP client for the contact form: submission port, STARTTLS with the
 * certificate checked, AUTH LOGIN. No dependencies, because the site is static
 * files plus this one endpoint and has no Composer on the server.
 *
 * This file only defines functions. Apache refuses to serve it directly (see
 * api/.htaccess), and even if it did, it would print nothing.
 */

final class SmtpException extends RuntimeException
{
}

/**
 * Loads the mail settings, which never live in the repository.
 *
 * First the path in the AUDIOGUIA_MAIL_CONFIG environment variable, then
 * audioguia-mail.php one level above the document root. This file sits in
 * <document root>/api/, so the document root is dirname(__DIR__) and the
 * level above it is dirname(__DIR__, 2).
 *
 * @return array<string, mixed>
 */
function audioguia_mail_config(): array
{
    $candidates = [];
    $fromEnv = getenv('AUDIOGUIA_MAIL_CONFIG');
    if (is_string($fromEnv) && $fromEnv !== '') {
        $candidates[] = $fromEnv;
    }
    $candidates[] = dirname(__DIR__, 2) . '/audioguia-mail.php';

    foreach ($candidates as $path) {
        if (is_file($path) && is_readable($path)) {
            $config = require $path;
            if (!is_array($config)) {
                throw new SmtpException('Mail config does not return an array: ' . $path);
            }
            foreach (['host', 'port', 'username', 'password', 'from_email', 'to_email'] as $key) {
                if (empty($config[$key])) {
                    throw new SmtpException('Mail config is missing "' . $key . '"');
                }
            }
            return $config;
        }
    }

    throw new SmtpException('No mail config found (AUDIOGUIA_MAIL_CONFIG or ../audioguia-mail.php)');
}

/** Encodes a header value as RFC 2047 UTF-8 when it is not plain ASCII. */
function smtp_encode_header(string $value): string
{
    $value = str_replace(["\r", "\n"], ' ', $value);
    if (preg_match('/^[\x20-\x7E]*$/', $value) === 1) {
        return $value;
    }
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

/** "Name <address>", with the name encoded. Addresses were validated before. */
function smtp_format_address(string $email, string $name = ''): string
{
    $email = str_replace(["\r", "\n", '<', '>'], '', $email);
    $name = trim($name);
    if ($name === '') {
        return '<' . $email . '>';
    }
    $encoded = smtp_encode_header($name);
    if ($encoded === $name) {
        $encoded = '"' . addcslashes($name, '"\\') . '"';
    }
    return $encoded . ' <' . $email . '>';
}

/**
 * Builds the whole message: plain text UTF-8, CRLF line ends, dot-stuffed.
 *
 * @param array<string, mixed> $config
 */
function smtp_build_message(array $config, string $subject, string $body, ?string $replyTo, string $replyToName): string
{
    $fromEmail = (string) $config['from_email'];
    $domain = substr((string) strrchr($fromEmail, '@'), 1) ?: 'localhost';

    $headers = [
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
        'From: ' . smtp_format_address($fromEmail, (string) ($config['from_name'] ?? '')),
        'To: ' . smtp_format_address((string) $config['to_email'], (string) ($config['to_name'] ?? '')),
        'Subject: ' . smtp_encode_header($subject),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ];
    if ($replyTo !== null) {
        $headers[] = 'Reply-To: ' . smtp_format_address($replyTo, $replyToName);
    }

    $body = str_replace(["\r\n", "\r"], "\n", $body);
    $lines = explode("\n", $body);
    foreach ($lines as &$line) {
        // SMTP dot-stuffing: a line that starts with a dot gets a second one.
        if (isset($line[0]) && $line[0] === '.') {
            $line = '.' . $line;
        }
    }
    unset($line);

    return implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $lines) . "\r\n";
}

/**
 * Reads one SMTP reply, which may span several lines, and checks its code.
 *
 * @param resource $socket
 */
function smtp_expect($socket, int $expected, string $step): string
{
    $reply = '';
    while (($line = fgets($socket, 1024)) !== false) {
        $reply .= $line;
        // A multi-line reply has a dash after the code on every line but the last.
        if (strlen($line) < 4 || $line[3] !== '-') {
            break;
        }
    }
    if ($reply === '') {
        $meta = stream_get_meta_data($socket);
        throw new SmtpException($step . ': no reply' . (!empty($meta['timed_out']) ? ' (timeout)' : ''));
    }
    if ((int) substr($reply, 0, 3) !== $expected) {
        throw new SmtpException($step . ': expected ' . $expected . ', got ' . trim($reply));
    }
    return $reply;
}

/** @param resource $socket */
function smtp_send_line($socket, string $line): void
{
    if (fwrite($socket, $line . "\r\n") === false) {
        throw new SmtpException('Write to SMTP server failed');
    }
}

/**
 * Sends one message through the configured account.
 *
 * The visitor never controls From or To: both come from the config. Their
 * address, already validated, only goes in Reply-To.
 *
 * @param array<string, mixed> $config
 */
function smtp_send(array $config, string $subject, string $body, ?string $replyTo = null, string $replyToName = ''): void
{
    $host = (string) $config['host'];
    $port = (int) $config['port'];
    $timeout = (int) ($config['timeout'] ?? 30);

    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'peer_name' => $host,
            'allow_self_signed' => false,
        ],
    ]);

    $socket = @stream_socket_client(
        'tcp://' . $host . ':' . $port,
        $errno,
        $errstr,
        $timeout,
        STREAM_CLIENT_CONNECT,
        $context
    );
    if ($socket === false) {
        throw new SmtpException('Connect to ' . $host . ':' . $port . ' failed: ' . $errstr . ' (' . $errno . ')');
    }
    stream_set_timeout($socket, $timeout);

    try {
        $ehloName = gethostname() ?: 'localhost';

        smtp_expect($socket, 220, 'greeting');
        smtp_send_line($socket, 'EHLO ' . $ehloName);
        smtp_expect($socket, 250, 'EHLO');

        smtp_send_line($socket, 'STARTTLS');
        smtp_expect($socket, 220, 'STARTTLS');
        $crypto = STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
        if (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT')) {
            $crypto |= STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT;
        }
        if (stream_socket_enable_crypto($socket, true, $crypto) !== true) {
            throw new SmtpException('TLS handshake failed (certificate or hostname)');
        }

        // The server forgets everything said before STARTTLS.
        smtp_send_line($socket, 'EHLO ' . $ehloName);
        smtp_expect($socket, 250, 'EHLO after STARTTLS');

        smtp_send_line($socket, 'AUTH LOGIN');
        smtp_expect($socket, 334, 'AUTH LOGIN');
        smtp_send_line($socket, base64_encode((string) $config['username']));
        smtp_expect($socket, 334, 'AUTH username');
        smtp_send_line($socket, base64_encode((string) $config['password']));
        smtp_expect($socket, 235, 'AUTH password');

        smtp_send_line($socket, 'MAIL FROM:<' . $config['from_email'] . '>');
        smtp_expect($socket, 250, 'MAIL FROM');
        smtp_send_line($socket, 'RCPT TO:<' . $config['to_email'] . '>');
        smtp_expect($socket, 250, 'RCPT TO');

        smtp_send_line($socket, 'DATA');
        smtp_expect($socket, 354, 'DATA');
        $message = smtp_build_message($config, $subject, $body, $replyTo, $replyToName);
        if (fwrite($socket, $message . ".\r\n") === false) {
            throw new SmtpException('Write of message body failed');
        }
        smtp_expect($socket, 250, 'end of DATA');

        smtp_send_line($socket, 'QUIT');
    } finally {
        fclose($socket);
    }
}
