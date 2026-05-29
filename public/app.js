// ============================================================
// 設定
// ============================================================

// ① デモ用のログイン情報（クライアント側の簡易認証）
//    本番運用ではサーバー側認証に置き換えてください。
const CREDENTIALS = {
  demo: "demopass",
};

const SESSION_KEY = "heliport_logged_in";

// ============================================================
// ① ログイン処理
// ============================================================
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const appEl = document.getElementById("app");
const logoutBtn = document.getElementById("logout-btn");

let mapInitialized = false;

function showApp() {
  loginScreen.hidden = true;
  appEl.hidden = false;
  if (!mapInitialized) {
    initMap();
    mapInitialized = true;
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appEl.hidden = true;
}

// 既にログイン済みなら（同一セッション内）スキップ
if (sessionStorage.getItem(SESSION_KEY) === "true") {
  showApp();
}

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (CREDENTIALS[username] !== undefined && CREDENTIALS[username] === password) {
    loginError.hidden = true;
    sessionStorage.setItem(SESSION_KEY, "true");
    showApp();
  } else {
    loginError.hidden = false;
  }
});

// 「パスワードをお忘れの方はこちら」リンク（デモ用）
const forgotLink = document.getElementById("forgot-password");
if (forgotLink) {
  forgotLink.addEventListener("click", (e) => {
    e.preventDefault();
    alert("パスワードの再設定は管理者にお問い合わせください。（デモ環境）");
  });
}

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  loginForm.reset();
  showLogin();
});

// ============================================================
// ②③ マップ + ヘリポートマーカー
// ============================================================
function initMap() {
  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
        satellite: {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          attribution:
            'Imagery &copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
        },
      },
      layers: [
        {
          id: "osm-tiles",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19,
        },
        {
          id: "satellite-tiles",
          type: "raster",
          source: "satellite",
          minzoom: 0,
          maxzoom: 19,
          layout: { visibility: "none" }, // 初期は地図（OSM）を表示
        },
      ],
    },
    center: [138.5, 37.5], // 日本のおよその中心
    zoom: 4.5,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  // ベースマップ（地図 / 衛星画像）の切り替えコントロール
  function setupBasemapSwitcher() {
    const switcher = document.getElementById("basemap-switcher");
    switcher.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-base]");
      if (!btn) return;
      const base = btn.dataset.base; // "osm" | "satellite"
      map.setLayoutProperty("osm-tiles", "visibility", base === "osm" ? "visible" : "none");
      map.setLayoutProperty("satellite-tiles", "visibility", base === "satellite" ? "visible" : "none");
      switcher.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  }
  setupBasemapSwitcher();

  // type → 表示用の種別名
  function typeLabel(type) {
    if (type === "ap") return "空港";
    if (type === "h") return "ヘリポート";
    if (type === "v") return "バーティポート";
    return type || "";
  }

  // 値の整形（空欄はそのまま空文字 → ラベルのみ表示）
  function fmt(v, suffix) {
    if (v === undefined || v === null) return "";
    const s = String(v).trim();
    if (s === "") return "";
    return suffix ? s + suffix : s;
  }

  // ③ 詳細モーダルの本文（4セクション）を組み立てる
  function buildDetailSections(p) {
    const size = p.sizeL && p.sizeW ? `${p.sizeL} × ${p.sizeW} m` : "";
    const sections = [
      {
        title: "基本情報",
        rows: [
          ["種別", typeLabel(p.type)],
          ["所有者/管理者", fmt(p.owner)],
          ["住所", fmt(p.address)],
          ["緯度", fmt(p.latText)],
          ["経度", fmt(p.lonText)],
          ["標高", fmt(p.elev, " m")],
        ],
      },
      {
        title: "ハンドリング情報",
        rows: [
          ["車両乗り入れ", ""],
          ["地元タクシー", ""],
          ["安全確保", ""],
        ],
      },
      {
        title: "場面情報",
        rows: [
          ["サイズ", size],
          ["進入離脱勾配", ""],
          ["許可状況", ""],
          ["燃料情報", ""],
          ["周辺情報", ""],
        ],
      },
      {
        title: "利用料金等",
        rows: [
          ["地権者への支払い", ""],
          ["その他", ""],
        ],
      },
    ];

    return sections
      .map(
        (s) => `
        <div class="info-section">
          <h3 class="section-title">${escapeHtml(s.title)}</h3>
          <table class="info-table">
            ${s.rows
              .map(
                ([k, v]) =>
                  `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`
              )
              .join("")}
          </table>
        </div>`
      )
      .join("");
  }

  // モーダルの開閉
  const modal = document.getElementById("detail-modal");
  function openDetailModal(p) {
    document.getElementById("modal-title").textContent = p.name || "";
    document.getElementById("modal-body").innerHTML = buildDetailSections(p);
    modal.hidden = false;
  }
  function closeDetailModal() {
    modal.hidden = true;
  }

  // 閉じる操作: ×ボタン / 背景クリック / Escキー
  document.getElementById("modal-close").addEventListener("click", closeDetailModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeDetailModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeDetailModal();
  });

  // 下部ボタン（まだ機能なし・プレースホルダー）
  modal.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      alert("この機能は準備中です。");
    });
  });

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // type → 円内に表示するラベル（h: ヘリポート, ap: 空港）
  function labelForType(type) {
    if (type === "ap") return "AP";
    return "H";
  }

  // 円アイコン（指定色の丸 + 白縁 + 白ラベル）を Canvas で生成して登録
  function addMarkerIcon(key, label, color) {
    if (map.hasImage(key)) return;
    const size = 64; // デバイスピクセル（pixelRatio 2 で約32px表示）
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const c = size / 2;

    ctx.beginPath();
    ctx.arc(c, c, c - 6, 0, Math.PI * 2);
    ctx.fillStyle = color || "#d32f2f";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // ラベルの文字数に応じてフォントサイズを調整（H=大きく, AP=やや小さく）
    const fontSize = label.length >= 2 ? 24 : 34;
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, c, c + 1);

    const img = ctx.getImageData(0, 0, size, size);
    map.addImage(key, img, { pixelRatio: 2 });
  }

  // データに含まれる iconKey ごとにアイコンを生成（type と color の組み合わせ）
  function registerIcons(features) {
    const seen = new Set();
    features.forEach((f) => {
      const p = f.properties;
      const key = p.iconKey || `${p.type}_${p.color}`;
      if (seen.has(key)) return;
      seen.add(key);
      addMarkerIcon(key, labelForType(p.type), p.color);
    });
  }

  // GeoJSON を読み込み、シンボルレイヤー（GPU描画）として配置
  map.on("load", () => {
    fetch("heliports.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`GeoJSON load failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const features = data.features || [];
        const numH = features.filter((f) => f.properties.type === "h").length;
        const numVp = features.filter((f) => f.properties.type === "v").length;
        document.getElementById("count").textContent =
          `ヘリポート ${numH} か所 / バーティポート ${numVp} か所`;

        // type・color の組み合わせごとにアイコンを登録
        registerIcons(features);

        // データソース + シンボルレイヤーを追加
        map.addSource("heliports", { type: "geojson", data });
        map.addLayer({
          id: "heliport-markers",
          type: "symbol",
          source: "heliports",
          layout: {
            "icon-image": ["get", "iconKey"], // type_color ごとのアイコン
            "icon-anchor": "center",
            "icon-allow-overlap": true,   // 重なっても全て表示
            "icon-ignore-placement": true,
          },
        });

        // ③ アイコンをクリックすると詳細モーダルを表示
        map.on("click", "heliport-markers", (e) => {
          openDetailModal(e.features[0].properties);
        });

        // ホバーでカーソルを変更
        map.on("mouseenter", "heliport-markers", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "heliport-markers", () => {
          map.getCanvas().style.cursor = "";
        });

        // 全マーカーが収まるように表示範囲を調整
        const bounds = new maplibregl.LngLatBounds();
        features.forEach((f) => bounds.extend(f.geometry.coordinates));
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 0 });
        }
      })
      .catch((err) => {
        console.error(err);
        alert("ヘリポートデータの読み込みに失敗しました。\n" + err.message);
      });
  });
}
