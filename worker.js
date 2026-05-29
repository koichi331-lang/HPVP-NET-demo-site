// Cloudflare Worker（静的アセットの前段で実行される関所）
//
// サイトを表示する前に Basic 認証（ユーザー名・パスワード）を要求します。
// 認証情報はこのファイルには書きません。Cloudflare の「Runtime」変数から読み込むので、
// GitHub で public 公開してもパスワードは漏れません。
//
// 必要な Runtime 変数（Worker の Settings → Variables and Secrets → Runtime で設定）:
//   BASIC_USER … ログイン用ユーザー名（例: demo）
//   BASIC_PASS … ログイン用パスワード（例: 任意の合言葉）※ Encrypt 推奨

export default {
  async fetch(request, env) {
    // 変数が未設定なら、設定を促すメッセージを返す（設定ミスの気づき用）
    if (!env.BASIC_USER || !env.BASIC_PASS) {
      return new Response(
        "認証情報が未設定です。Worker の Runtime 変数 BASIC_USER / BASIC_PASS を設定してください。",
        { status: 500, headers: { "Content-Type": "text/plain; charset=UTF-8" } }
      );
    }

    const expected = "Basic " + btoa(`${env.BASIC_USER}:${env.BASIC_PASS}`);
    const provided = request.headers.get("Authorization") || "";

    // 不一致・未入力ならブラウザの認証ダイアログを表示
    if (provided !== expected) {
      return new Response("認証が必要です。", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Heliport Demo", charset="UTF-8"',
          "Content-Type": "text/plain; charset=UTF-8",
        },
      });
    }

    // 認証OK → public/ 内の静的ファイルを配信
    return env.ASSETS.fetch(request);
  },
};
