<?php
/*
 * Kids Quiz — Instagram publisher API (used by admin/index.html).
 * Same flow as instashop (Instagram API with Instagram Login):
 *   photo: POST /{ig-user}/media {image_url, caption} -> container -> poll status -> POST /{ig-user}/media_publish
 *   reel:  POST /{ig-user}/media {media_type:REELS, video_url | upload_type:resumable, caption}
 *          (+ resumable bytes to rupload.facebook.com when the file is not on a public URL)
 * All requests need the X-Admin-Key header = admin_password from config.php.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$CFG_FILE = __DIR__ . '/config.php';
$CFG = is_file($CFG_FILE) ? (array)include $CFG_FILE : [];
$MEDIA_DIR = __DIR__ . '/media';

function out(array $d, int $code = 200): void { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function cfg(string $k, $def = '') { global $CFG; return isset($CFG[$k]) && $CFG[$k] !== '' ? $CFG[$k] : $def; }
function ig_ready(): bool { return cfg('ig_user_id') !== '' && cfg('ig_access_token') !== ''; }
// Public https address of this admin folder: config "public_base_url", or (when that
// is empty) the address this page was opened from - e.g. a Cloudflare quick tunnel
// started by admin/start-public.sh (https://<random>.trycloudflare.com).
function base_url(): string {
    $b = (string)cfg('public_base_url');
    if ($b !== '') return rtrim($b, '/');
    $https = (($_SERVER['HTTPS'] ?? '') === 'on') || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' || strpos((string)($_SERVER['HTTP_CF_VISITOR'] ?? ''), 'https') !== false;
    $host = (string)($_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? ''));
    if (!$https || $host === '' || !preg_match('/^[A-Za-z0-9.-]+(:\d+)?$/', $host)) return '';
    $dir = rtrim(str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api.php'))), '/');
    return 'https://' . $host . $dir;
}
function public_ok(): bool {
    $u = parse_url(base_url());
    $h = strtolower($u['host'] ?? '');
    return ($u['scheme'] ?? '') === 'https' && $h !== '' && $h !== 'localhost' && !preg_match('/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/', $h);
}
function public_url(string $file): string { return base_url() . '/media/' . rawurlencode($file); }

function ig(string $method, string $path, array $params = []): array {
    $url = rtrim((string)cfg('ig_graph_base'), '/') . '/' . cfg('graph_version', 'v21.0') . '/' . ltrim($path, '/');
    if ($method === 'GET' && $params) { $url .= '?' . http_build_query($params); $params = []; }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . cfg('ig_access_token')]]);
    if ($method !== 'GET') curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if ($raw === false || $code >= 300 || !is_array($j) || isset($j['error'])) {
        $msg = is_array($j) && isset($j['error']['message']) ? $j['error']['message'] : ($err ?: "HTTP $code");
        throw new RuntimeException('Instagram: ' . $msg);
    }
    return $j;
}
function ig_upload_video(string $containerId, string $file): void {
    $url = 'https://rupload.facebook.com/ig-api-upload/' . cfg('graph_version', 'v21.0') . '/' . rawurlencode($containerId);
    $size = filesize($file); $fh = fopen($file, 'rb');
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_UPLOAD => true, CURLOPT_CUSTOMREQUEST => 'POST', CURLOPT_INFILE => $fh, CURLOPT_INFILESIZE => $size,
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 600,
        CURLOPT_HTTPHEADER => ['Authorization: OAuth ' . cfg('ig_access_token'), 'offset: 0', 'file_size: ' . $size, 'Content-Type: application/octet-stream']]);
    $raw = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch); fclose($fh);
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if ($code >= 300 || empty($j['success'])) throw new RuntimeException('Video upload to Instagram failed (HTTP ' . $code . ')');
}

// ---------- auth ----------
$action = $_GET['action'] ?? '';
if ($action !== 'ping') {
    $key = $_SERVER['HTTP_X_ADMIN_KEY'] ?? '';
    $pw = (string)cfg('admin_password');
    if ($pw === '' || $pw === 'change-me') out(['ok' => false, 'error' => 'Set admin_password in admin/config.php first (copy config.sample.php).'], 503);
    if (!hash_equals($pw, (string)$key)) { usleep(400000); out(['ok' => false, 'error' => 'Wrong admin password.'], 401); }
}

try {
    switch ($action) {
        case 'ping':
            out(['ok' => true, 'configured' => is_file($CFG_FILE), 'php' => PHP_VERSION]);

        case 'status':
            $acct = null;
            if (ig_ready()) {
                try { $acct = ig('GET', (string)cfg('ig_user_id'), ['fields' => 'username,name,followers_count,media_count,profile_picture_url']); }
                catch (Throwable $e) { $acct = ['error' => $e->getMessage()]; }
            }
            out(['ok' => true, 'instagram' => ig_ready(), 'publicMedia' => public_ok(), 'account' => $acct]);

        case 'upload':   // multipart "file" (image/png|jpeg or video/mp4)
            if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) out(['ok' => false, 'error' => 'No file received.'], 400);
            $f = $_FILES['file'];
            if ($f['size'] > 100 * 1024 * 1024) out(['ok' => false, 'error' => 'File is larger than 100 MB.'], 400);
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
            $ext = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'video/mp4' => 'mp4', 'video/quicktime' => 'mov'][$mime] ?? null;
            if (!$ext) out(['ok' => false, 'error' => 'Only PNG, JPG, MP4 or MOV files.'], 400);
            if (!is_dir($MEDIA_DIR)) mkdir($MEDIA_DIR, 0775, true);
            $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
            // Instagram feed photos must be JPEG: convert PNG uploads
            if ($ext === 'png' && function_exists('imagecreatefrompng')) {
                $im = imagecreatefrompng($f['tmp_name']); $name = preg_replace('/\.png$/', '.jpg', $name);
                $bg = imagecreatetruecolor(imagesx($im), imagesy($im)); imagefill($bg, 0, 0, imagecolorallocate($bg, 255, 255, 255));
                imagecopy($bg, $im, 0, 0, 0, 0, imagesx($im), imagesy($im)); imagejpeg($bg, "$MEDIA_DIR/$name", 92);
            } else move_uploaded_file($f['tmp_name'], "$MEDIA_DIR/$name");
            out(['ok' => true, 'file' => $name, 'kind' => in_array($ext, ['mp4', 'mov'], true) ? 'reel' : 'photo', 'publicUrl' => public_ok() ? public_url($name) : null]);

        case 'publish':  // JSON {file, kind: photo|reel, caption}
            if (!ig_ready()) out(['ok' => false, 'error' => 'Instagram is not connected: add ig_user_id and ig_access_token to admin/config.php.'], 501);
            $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
            $file = basename((string)($in['file'] ?? '')); $caption = mb_substr((string)($in['caption'] ?? ''), 0, 2200);
            if ($file === '' || !is_file("$MEDIA_DIR/$file")) out(['ok' => false, 'error' => 'Upload the media first.'], 400);
            $igu = (string)cfg('ig_user_id');
            if (($in['kind'] ?? 'photo') === 'reel') {
                $p = ['media_type' => 'REELS', 'caption' => $caption, 'share_to_feed' => 'true'];
                if (public_ok()) $c = ig('POST', "$igu/media", $p + ['video_url' => public_url($file)]);
                else { $c = ig('POST', "$igu/media", $p + ['upload_type' => 'resumable']); ig_upload_video((string)$c['id'], "$MEDIA_DIR/$file"); }
            } else {
                if (!public_ok()) out(['ok' => false, 'error' => 'Photo posts need a public https address: run admin/start-public.sh and open the admin page from the https://….trycloudflare.com link it prints (or set public_base_url in admin/config.php) — Instagram downloads the photo from there. Download the image and post it from the Instagram app, or run this admin on your https server.'], 400);
                $c = ig('POST', "$igu/media", ['image_url' => public_url($file), 'caption' => $caption]);
            }
            out(['ok' => true, 'containerId' => (string)$c['id']]);

        case 'check':    // ?id=container — publishes when Instagram has finished processing
            $id = preg_replace('/[^0-9]/', '', (string)($_GET['id'] ?? ''));
            $st = ig('GET', $id, ['fields' => 'status_code,status']);
            $code = $st['status_code'] ?? 'IN_PROGRESS';
            if ($code === 'FINISHED') {
                $pub = ig('POST', cfg('ig_user_id') . '/media_publish', ['creation_id' => $id]);
                $m = ig('GET', (string)$pub['id'], ['fields' => 'permalink']);
                out(['ok' => true, 'status' => 'published', 'permalink' => $m['permalink'] ?? '']);
            }
            if (in_array($code, ['ERROR', 'EXPIRED'], true)) out(['ok' => false, 'status' => 'failed', 'error' => (string)($st['status'] ?? $code)], 502);
            out(['ok' => true, 'status' => 'processing']);

        default:
            out(['ok' => false, 'error' => 'Unknown action.'], 404);
    }
} catch (Throwable $e) {
    out(['ok' => false, 'error' => $e->getMessage()], 502);
}
