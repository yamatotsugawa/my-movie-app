// src/app/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';

// Firebase関連のインポート
// Firebase SDKはpackage.jsonに依存関係として追加されている必要があります。
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, increment, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';

// TMDB APIのベースURL
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// APIキーは環境変数から取得
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

// Gemini APIのキー (Canvasが自動で提供)
const GEMINI_API_KEY = ""; // この行は変更しないでください。Canvasが実行時にAPIキーを挿入します。

// Vercelの環境変数からFirebase設定を読み込む
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // 必要であれば
};

// 映画データの型定義
interface MovieData {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
  'watch/providers'?: {
    results: {
      JP?: {
        link?: string;
        flatrate?: Provider[];
        buy?: Provider[];
        rent?: Provider[];
      };
    };
  };
}

// ストリーミングサービスプロバイダーの型定義
interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

// アプリ内で使用する映画結果の型定義
interface AppMovieResult {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  streamingServices?: { name: string; logo: string; link?: string; trackingPixel?: string }[];
  justWatchLink?: string;
}

// チャットメッセージの型定義
interface ChatMessage {
  id: string; // ドキュメントID
  userId: string;
  message: string;
  timestamp: number; // FirestoreのTimestampをnumberとして扱う
}

export default function Home() {
  const [movieTitle, setMovieTitle] = useState<string>('');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedMovieTitles, setSuggestedMovieTitles] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);

  // FirebaseとFirestoreのステート
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [accessCount, setAccessCount] = useState<number>(0);

  // チャット関連のステート
  const [chatMessages, setChatMessages] = useState<{ [movieId: number]: ChatMessage[] }>({});
  const [chatInputs, setChatInputs] = useState<{ [movieId: number]: string }>({});
  const chatListeners = useRef<{ [movieId: number]: () => void }>({});

  // Firebaseの初期化と認証
  useEffect(() => {
    const initFirebase = async () => {
      // Firebase設定が不完全な場合はエラー
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error("Firebase configuration is incomplete. Check environment variables.");
        setError("Firebaseの設定が不完全です。Vercelの環境変数を確認してください。");
        return;
      }

      try {
        const app = initializeApp(firebaseConfig as any);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);
        setDb(firestoreDb);
        setAuth(firebaseAuth);

        // 匿名認証を直接呼び出す
        await signInAnonymously(firebaseAuth);

        onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            setUserId(crypto.randomUUID());
          }
        });
      } catch (e: unknown) {
        let errorMessage = 'Firebaseの初期化またはサインインに失敗しました。';
        if (e instanceof Error) {
          errorMessage = e.message;
        } else if (typeof e === 'string') {
          errorMessage = e;
        }
        console.error("Error initializing Firebase or signing in:", errorMessage);
        setError(`Firebaseの初期化に失敗しました: ${errorMessage}`);
      }
    };

    initFirebase();

    // コンポーネントアンマウント時に全てのチャットリスナーをクリーンアップ
    return () => {
      for (const movieId in chatListeners.current) {
        if (chatListeners.current[movieId]) {
          chatListeners.current[movieId](); // unsubscribeを呼び出す
        }
      }
    };
  }, []); // 空の依存配列でコンポーネントマウント時に一度だけ実行

  // アクセス数をFirestoreでカウント
  useEffect(() => {
    if (db && userId) {
      // Canvas環境から提供される__app_idをここで直接使用
      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const accessDocRef = doc(db, `artifacts/${currentAppId}/public/data/access_counts`, 'global_access');

      const incrementAccess = async () => {
        try {
          await setDoc(accessDocRef, { count: increment(1) }, { merge: true });
          console.log("Access count incremented.");
        } catch (e) {
          console.error("Error incrementing access count:", e);
        }
      };

      incrementAccess();

      const unsubscribe = onSnapshot(accessDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setAccessCount(docSnap.data()?.count || 0);
        } else {
          setAccessCount(0);
        }
      });

      return () => unsubscribe();
    }
  }, [db, userId]); // dbとuserIdが変更されたときに再実行

  // 各映画のチャットメッセージをリアルタイムで取得
  useEffect(() => {
    if (db && results.length > 0) {
      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

      // 現在アクティブなリスナーを解除
      for (const movieId in chatListeners.current) {
        if (!results.some(r => r.id === parseInt(movieId))) { // 表示されていない映画のリスナーを解除
          chatListeners.current[movieId]();
          delete chatListeners.current[movieId];
        }
      }

      results.forEach(movie => {
        if (!chatListeners.current[movie.id]) { // まだリスナーが設定されていない場合のみ
          const chatCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/movie_chats/${movie.id}/messages`);
          const q = query(chatCollectionRef, orderBy('timestamp', 'asc')); // タイムスタンプで昇順ソート

          const unsubscribe = onSnapshot(q, (snapshot) => {
            const messages: ChatMessage[] = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              messages.push({
                id: doc.id,
                userId: data.userId,
                message: data.message,
                timestamp: data.timestamp?.toMillis ? data.timestamp.toMillis() : data.timestamp, // Timestampオブジェクトをミリ秒に変換
              });
            });
            setChatMessages(prev => ({
              ...prev,
              [movie.id]: messages
            }));
          }, (error) => {
            console.error(`Error fetching chat messages for movie ${movie.id}:`, error);
          });
          chatListeners.current[movie.id] = unsubscribe; // リスナーを保存
        }
      });
    }
  }, [db, results]); // dbとresultsが変更されたときに再実行

  // 各オンデマンドサービスへのリンクを生成するヘルパー関数
  const getServiceSpecificLink = (providerName: string, movieTitle: string, justWatchMovieLink?: string): { link: string; trackingPixel?: string } => {
    // AmazonアソシエイトのトラッキングIDをここに設定してください
    // 例: const amazonTrackingId = "your-amazon-associate-id-22";
    const amazonTrackingId = ""; // あなたのトラッキングIDに置き換えてください

    switch (providerName) {
      case 'Amazon Prime Video':
        // AmazonでDVDを検索するアフィリエイトリンク
        return { link: `https://www.amazon.co.jp/s?k=${encodeURIComponent(movieTitle)}&i=dvd&rh=n%3A561956&tag=${amazonTrackingId}` };
      case 'Netflix':
        // Netflixは直接検索ページへのリンクが提供されていないため、トップページへ
        return { link: 'https://www.netflix.com/jp/' };
      case 'U-NEXT':
        // U-NEXTのアフィリエイトリンクとトラッキングピクセル
        return {
          link: 'https://px.a8.net/svt/ejp?a8mat=35HC44+2G46B6+3250+6MC8Y',
          trackingPixel: 'https://www16.a8.net/0.gif?a8mat=35HC44+2G46B6+3250+6MC8Y'
        };
      case 'Hulu':
        return { link: 'https://www.hulu.jp/' };
      case 'Disney Plus':
        return { link: 'https://www.disneyplus.com/ja-jp' };
      case 'Apple TV':
        return { link: `https://tv.apple.com/jp/search/${encodeURIComponent(movieTitle)}` };
      case 'Google Play Movies':
        return { link: `https://play.google.com/store/search?q=${encodeURIComponent(movieTitle)}&c=movies` };
      case 'YouTube':
        return { link: `https://www.youtube.com/results?search_query=${encodeURIComponent(movieTitle)}+full+movie` };
      default:
        return { link: justWatchMovieLink || '#' };
    }
  };

  // Gemini APIを呼び出して映画タイトルを提案する関数
  const fetchMovieSuggestions = async (query: string) => {
    setLoadingSuggestions(true);
    setSuggestedMovieTitles([]); // 以前の提案をクリア

    try {
      let chatHistory = [];
      const prompt = `ユーザーが映画タイトルを検索しましたが、結果が見つかりませんでした。元の検索クエリは「${query}」です。このクエリに似ている可能性のある、最大5つの異なる映画タイトルを提案してください。各タイトルは改行で区切ってください。もし提案がなければ「なし」とだけ答えてください。`;
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = { contents: chatHistory };
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        if (text.trim().toLowerCase() !== 'なし') {
          // 改行で区切られたタイトルを配列に変換
          const suggestions = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
          setSuggestedMovieTitles(suggestions);
        }
      } else {
        console.warn('Gemini APIから有効な提案がありませんでした。');
      }
    } catch (err: unknown) {
      let errorMessage = '提案の取得中に不明なエラーが発生しました。';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error('映画提案取得エラー:', errorMessage);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setResults([]);
    setSuggestedMovieTitles([]); // 新しい検索の前に提案をクリア

    if (!movieTitle.trim()) {
      setError('映画名を入力してください。');
      setLoading(false);
      return;
    }

    if (!TMDB_API_KEY) {
      setError('APIキーが設定されていません。`.env.local`を確認してください。');
      setLoading(false);
      return;
    }

    try {
      const searchUrl = `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(movieTitle)}&api_key=${TMDB_API_KEY}&language=ja-JP`;
      const searchResponse = await fetch(searchUrl);

      if (!searchResponse.ok) {
        throw new Error(`映画検索API呼び出しに失敗しました: ${searchResponse.statusText} (ステータスコード: ${searchResponse.status})`);
      }
      const searchData: { results: MovieData[] } = await searchResponse.json();

      if (searchData.results && searchData.results.length > 0) {
        const moviesWithStreamingPromises = searchData.results.map(async (movie: MovieData) => {
          try {
            const providersUrl = `${TMDB_BASE_URL}/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`;
            const providersResponse = await fetch(providersUrl);

            let justWatchLink: string | undefined = undefined;
            let services: { name: string; logo: string; link?: string; trackingPixel?: string }[] = [];

            if (providersResponse.ok) {
              const providersData: { results: { JP?: { link?: string; flatrate?: Provider[]; buy?: Provider[]; rent?: Provider[] } } } = await providersResponse.json();
              const jpProviders = providersData.results?.JP;

              justWatchLink = jpProviders?.link;

              const addServices = (providerList: Provider[] | undefined) => {
                if (providerList) {
                  providerList.forEach((p: Provider) => {
                    const serviceLinkInfo = getServiceSpecificLink(p.provider_name, movie.title, justWatchLink);
                    services.push({
                      name: p.provider_name,
                      logo: p.logo_path,
                      link: serviceLinkInfo.link,
                      trackingPixel: serviceLinkInfo.trackingPixel,
                    });
                  });
                }
              };

              addServices(jpProviders?.flatrate);
              addServices(jpProviders?.buy);
              addServices(jpProviders?.rent);

              services = Array.from(new Map(services.map(item => [item['name'], item])).values());

            } else {
              console.warn(`視聴プロバイダー情報の取得に失敗しました (映画ID: