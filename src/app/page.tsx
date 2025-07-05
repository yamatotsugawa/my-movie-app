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

      const result = await response.json(); // ここでawaitを追加

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
              // ★修正: console.warnの文字列を閉じる
              console.warn(`視聴プロバイダー情報の取得に失敗しました (映画ID: ${movie.id}): ${providersResponse.statusText}`);
            }

            return {
              id: movie.id,
              title: movie.title,
              release_date: movie.release_date,
              overview: movie.overview,
              poster_path: movie.poster_path,
              streamingServices: services,
              justWatchLink: justWatchLink,
            };
          } catch (providerError: unknown) {
            let errorMessage = '不明なエラー';
            if (providerError instanceof Error) {
              errorMessage = providerError.message;
            } else if (typeof providerError === 'string') {
              errorMessage = providerError;
            }
            console.error(`視聴プロバイダー情報の取得中にエラーが発生しました (映画ID: ${movie.id}): ${errorMessage}`);
            return {
              id: movie.id,
              title: movie.title,
              release_date: movie.release_date,
              overview: movie.overview,
              poster_path: movie.poster_path,
              streamingServices: [],
              justWatchLink: undefined,
            };
          }
        });

        const finalResults = await Promise.all(moviesWithStreamingPromises);
        setResults(finalResults);

      } else {
        setError('一致する映画が見つかりませんでした。');
        fetchMovieSuggestions(movieTitle); // 提案をフェッチ
      }

    } catch (err: unknown) {
      let errorMessage = '不明なエラー';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      console.error('映画検索エラー:', errorMessage);
      setError(`映画の検索中にエラーが発生しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 提案されたタイトルをクリックしたときのハンドラ
  const handleSuggestedTitleClick = (suggestedTitle: string) => {
    setMovieTitle(suggestedTitle); // 検索ボックスに提案されたタイトルを設定
    // フォームをプログラムで送信して新しい検索を開始
    const form = document.querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  };

  // チャットメッセージの送信ハンドラ
  const handleSendMessage = async (movieId: number) => {
    if (!db || !userId) {
      setError('チャット機能が利用できません。');
      return;
    }
    const message = chatInputs[movieId]?.trim();
    if (!message) return;

    try {
      // Canvas環境から提供される__app_idをここで直接使用
      const currentAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const chatCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/movie_chats/${movieId}/messages`);
      await addDoc(chatCollectionRef, {
        userId: userId,
        message: message,
        timestamp: serverTimestamp(), // Firestoreのサーバータイムスタンプを使用
      });
      setChatInputs(prev => ({ ...prev, [movieId]: '' })); // 入力フィールドをクリア
    } catch (e) {
      console.error("Error sending message:", e);
      setError("メッセージの送信に失敗しました。");
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>どのオンデマンドで観れる？</h1>
      <form onSubmit={handleSearch} style={styles.form}>
        <input
          type="text"
          value={movieTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMovieTitle(e.target.value)}
          placeholder="映画名を入力してください"
          style={styles.input}
          disabled={loading}
        />
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? '検索中...' : '検索'}
        </button>
      </form>

      {error && <p style={styles.errorText}>{error}</p>}

      {/* アクセス数を表示 */}
      <p style={styles.accessCount}>累計アクセス数: {accessCount}</p>
      {userId && <p style={styles.userIdDisplay}>あなたのID: {userId}</p>}

      {/* 提案された映画タイトルを表示 */}
      {!loading && !error && results.length === 0 && suggestedMovieTitles.length > 0 && (
        <div style={styles.suggestionsContainer}>
          <p style={styles.suggestionsLabel}>もしかして？</p>
          <ul style={styles.suggestionsList}>
            {suggestedMovieTitles.map((suggestion, index) => (
              <li key={index} style={styles.suggestionItem}>
                <button
                  type="button"
                  onClick={() => handleSuggestedTitleClick(suggestion)}
                  style={styles.suggestionButton}
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {loadingSuggestions && results.length === 0 && !error && (
        <p style={styles.loadingSuggestions}>提案を生成中...</p>
      )}

      <div style={styles.resultsContainer}>
        {results.length > 0 ? (
          <>
            <h2 style={styles.resultsTitle}>検索結果</h2>
            <ul style={styles.resultsList}>
              {results.map((movie: AppMovieResult) => (
                <li key={movie.id} style={styles.resultItem}>
                  <div style={styles.movieContent}>
                    {movie.poster_path && (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                        alt={movie.title}
                        style={styles.poster}
                      />
                    )}
                    <div style={styles.movieDetails}>
                      <p style={styles.movieTitle}>
                        {movie.title} ({movie.release_date ? movie.release_date.substring(0, 4) : '不明'})
                      </p>
                      {movie.overview && (
                        <p style={styles.movieOverview}>
                          {movie.overview.length > 150 ? movie.overview.substring(0, 150) + '...' : movie.overview}
                        </p>
                      )}
                      <div style={styles.streamingProvidersContainer}>
                        <p style={styles.streamingProvidersLabel}>視聴可能サービス:</p>
                        {movie.streamingServices && movie.streamingServices.length > 0 ? (
                          <div style={styles.providerLogos}>
                            {movie.streamingServices.map((service, idx) => (
                              <span key={idx} style={styles.providerItem}>
                                {service.link && service.link !== '#' ? (
                                  <a
                                    href={service.link}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    style={styles.providerLink}
                                  >
                                    {service.logo && (
                                      <img
                                        src={`https://image.tmdb.org/t/p/w45${service.logo}`}
                                        alt={service.name}
                                        title={service.name}
                                        style={styles.providerLogo}
                                      />
                                    )}
                                    {/* トラッキングピクセルをレンダリング */}
                                    {service.trackingPixel && (
                                      <img
                                        src={service.trackingPixel}
                                        alt=""
                                        style={{ width: '1px', height: '1px', border: '0', position: 'absolute', left: '-9999px' }}
                                      />
                                    )}
                                  </a>
                                ) : (
                                  service.logo && (
                                    <img
                                      src={`https://image.tmdb.org/t/p/w45${service.logo}`}
                                      alt={service.name}
                                      title={service.name}
                                      style={styles.providerLogo}
                                    />
                                  )
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p style={styles.noStreamingInfoSmall}>情報なし</p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* 各映画のチャットセクション */}
                  <div style={styles.chatSection}>
                    <h3 style={styles.chatTitle}>この映画についてチャット</h3>
                    <div style={styles.chatMessagesContainer}>
                      {chatMessages[movie.id] && chatMessages[movie.id].length > 0 ? (
                        chatMessages[movie.id].map((msg, msgIdx) => (
                          <div key={msg.id} style={styles.chatMessage}>
                            <span style={styles.chatUserId}>{msg.userId.substring(0, 8)}...:</span>
                            <span style={styles.chatMessageText}>{msg.message}</span>
                            <span style={styles.chatTimestamp}>
                              {new Date(msg.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p style={styles.noMessages}>まだメッセージはありません。</p>
                      )}
                    </div>
                    <div style={styles.chatInputContainer}>
                      <input
                        type="text"
                        value={chatInputs[movie.id] || ''}
                        onChange={(e) => setChatInputs(prev => ({ ...prev, [movie.id]: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendMessage(movie.id);
                          }
                        }}
                        placeholder="メッセージを入力..."
                        style={styles.chatInput}
                        disabled={!userId}
                      />
                      <button
                        onClick={() => handleSendMessage(movie.id)}
                        style={styles.chatSendButton}
                        disabled={!userId || !chatInputs[movie.id]?.trim()}
                      >
                        送信
                      </button>
                    </div>
                    {!userId && <p style={styles.chatAuthWarning}>チャットを利用するには認証が必要です。</p>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          !loading && !error && suggestedMovieTitles.length === 0 && <p style={styles.noResults}>映画名を入力して検索してください。</p>
        )}
      </div>
    </div>
  );
}

// スタイルの追加と修正
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '800px',
    margin: '40px auto',
    padding: '20px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '30px',
  },
  form: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '30px',
  },
  input: {
    padding: '12px 15px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginRight: '10px',
    width: '60%',
    boxSizing: 'border-box',
  },
  button: {
    padding: '12px 20px',
    fontSize: '16px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  buttonHover: {
    backgroundColor: '#005bb5',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: '10px',
    marginBottom: '20px',
  },
  resultsContainer: {
    marginTop: '30px',
    borderTop: '1px solid #eee',
    paddingTop: '20px',
  },
  resultsTitle: {
    fontSize: '20px',
    color: '#555',
    marginBottom: '15px',
    textAlign: 'center',
  },
  resultsList: {
    listStyle: 'none',
    padding: '0',
  },
  resultItem: {
    backgroundColor: '#f9f9f9',
    border: '1px solid #eee',
    borderRadius: '5px',
    padding: '15px',
    marginBottom: '10px',
  },
  movieContent: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  poster: {
    width: '92px',
    height: 'auto',
    borderRadius: '4px',
    marginRight: '15px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  movieDetails: {
    flex: 1,
  },
  movieTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '5px',
    color: '#333',
  },
  movieOverview: {
    fontSize: '13px',
    color: '#555',
    marginBottom: '10px',
    lineHeight: '1.5',
  },
  streamingProvidersContainer: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  streamingProvidersLabel: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '5px',
    fontWeight: 'bold',
  },
  providerLogos: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  providerItem: {
    display: 'flex',
    alignItems: 'center',
  },
  providerLink: {
    display: 'flex',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  providerLogo: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '1px solid #ddd',
    objectFit: 'cover',
  },
  providerName: {
    fontSize: '12px',
    color: '#555',
    marginLeft: '5px',
  },
  noStreamingInfoSmall: {
    fontSize: '14px',
    color: '#999',
    fontStyle: 'italic',
  },
  suggestionsContainer: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f0f8ff',
    border: '1px solid #cceeff',
    borderRadius: '8px',
    textAlign: 'center',
  },
  suggestionsLabel: {
    fontSize: '1.1em',
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: '10px',
  },
  suggestionsList: {
    listStyle: 'none',
    padding: '0',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '10px',
  },
  suggestionItem: {
    // リストアイテムのスタイルは特に必要ないが、flexアイテムとして機能させる
  },
  suggestionButton: {
    backgroundColor: '#e0f7fa',
    color: '#0070f3',
    border: '1px solid #0070f3',
    borderRadius: '20px',
    padding: '8px 15px',
    cursor: 'pointer',
    fontSize: '0.95em',
    transition: 'background-color 0.3s ease, color 0.3s ease',
    '&:hover': {
      backgroundColor: '#0070f3',
      color: 'white',
    },
  },
  loadingSuggestions: {
    textAlign: 'center',
    fontSize: '1em',
    color: '#777',
    marginTop: '20px',
  },
  accessCount: {
    textAlign: 'center',
    fontSize: '0.9em',
    color: '#888',
    marginTop: '10px',
  },
  userIdDisplay: {
    textAlign: 'center',
    fontSize: '0.8em',
    color: '#a0a0a0',
    marginBottom: '20px',
  },
  chatSection: {
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px dashed #ddd',
    backgroundColor: '#fdfdfd',
    borderRadius: '8px',
  },
  chatTitle: {
    fontSize: '1.3em',
    color: '#333',
    marginBottom: '10px',
    textAlign: 'center',
  },
  chatMessagesContainer: {
    maxHeight: '200px',
    overflowY: 'auto',
    border: '1px solid #eee',
    borderRadius: '5px',
    padding: '10px',
    marginBottom: '10px',
    backgroundColor: '#fff',
  },
  chatMessage: {
    marginBottom: '8px',
    wordBreak: 'break-word',
  },
  chatUserId: {
    fontWeight: 'bold',
    color: '#0070f3',
    marginRight: '5px',
  },
  chatMessageText: {
    color: '#333',
  },
  chatTimestamp: {
    fontSize: '0.75em',
    color: '#999',
    marginLeft: '10px',
  },
  noMessages: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  chatInputContainer: {
    display: 'flex',
    gap: '10px',
  },
  chatInput: {
    flexGrow: 1,
    padding: '8px 12px',
    fontSize: '1em',
    border: '1px solid #ccc',
    borderRadius: '5px',
  },
  chatSendButton: {
    padding: '8px 15px',
    fontSize: '1em',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    '&:hover': {
      backgroundColor: '#218838',
    },
    '&:disabled': {
      backgroundColor: '#cccccc',
      cursor: 'not-allowed',
    },
  },
  chatAuthWarning: {
    fontSize: '0.8em',
    color: 'orange',
    textAlign: 'center',
    marginTop: '5px',
  },
};
