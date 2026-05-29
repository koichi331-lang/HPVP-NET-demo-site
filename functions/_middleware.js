// Cloudflare Pages のミドルウェア（全リクエストの前段で実行される関所）
//
// サイトを表示する前に Basic 認証（ユーザー名・パスワード）を要求します。
// 認証情報はこのファイルには書きません。Cloudflare の環境変数から読み込むので、
// GitHub で public 公開してもパスワードは漏れません。
//
// 必要な環境変数（Cloudflare ダッシュボードの Pages → Settings → Variables で設定）:
//   BASIC_USER … ログイン用ユーザー名（例: demo）
//   BASIC_PASS … ログイン用パスワード（例: 任意の合言葉）

export async function onRequest(context) {
  const { request, env, next } = context;

  // 環境変数が未設定なら、設定を促すメッセージを返す（設定ミスの気づき用）
  if (!env.BASIC_USER || !env.BASIC_PASS) {
    return new Response(
      "認証情報が未設定です。Cloudflare Pages の環境変数 BASIC_USER / BASIC_PASS を設定してください。",
      { status: 500, headers: { "Content-Type": "text/plain; charset=UTF-8" } }
    );
  }

  const expected = "Basic " + btoa(`${env.BASIC_USER}:${env.BASIC_PASS}`);
  const provided = request.headers.get("Authorization") || "";

  // 入力された認証情報が一致すれば、本来のページ（静的ファイル）へ進む
  if (provided === expected) {
    return next();
  }

  // 不一致・未入力ならブラウザの認証ダイアログを表示
  return new Response("認証が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Heliport Demo", charset="UTF-8"',
      "Content-Type": "text/plain; charset=UTF-8",
    },
  });
}
