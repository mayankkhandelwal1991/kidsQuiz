<?php
/*
 * Kids Quiz — Instagram publisher settings.
 * Copy this file to config.php (git-ignored) and fill it in. NEVER commit config.php.
 *
 * ig_user_id / ig_access_token: the kidsgames_quiz Instagram PROFESSIONAL account, from
 *   Meta "Instagram API with Instagram Login" (permission: instagram_business_content_publish).
 *   You can reuse the same Meta app that instashop uses — just generate a token for this account.
 * public_base_url: the public https address where THIS admin folder is served, e.g.
 *   https://www.instaeasy.shop/kidsquiz-admin  — Instagram downloads photos from here,
 *   so photo posts only work on a public https server (not localhost).
 */
return [
    'admin_password'  => 'change-me',                 // asked by the admin page before publishing
    'ig_user_id'      => '',
    'ig_access_token' => '',
    'ig_graph_base'   => 'https://graph.instagram.com',
    'graph_version'   => 'v21.0',
    'public_base_url' => '',                          // e.g. https://your-domain/kidsquiz/admin
];
