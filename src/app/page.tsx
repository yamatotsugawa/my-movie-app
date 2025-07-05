// src/app/page.tsx

'use client';

import { useState } from 'react';
import React from 'react';
// import Link from 'next/link'; // Linkコンポーネントはもう使わないので削除済み

// TMDB APIのベースURL
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// APIキーは環境変数から取得
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

// Gemini APIのキー (Canvasが自動で提供)
const GEMINI_API_KEY = ""; // この行は変更しないでください。Canvasが実行時にAPIキーを挿入します。

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

export default function Home() {
  const [movieTitle, setMovieTitle] = useState<string>('');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  // ★追加: 提案された映画タイトルを保持するステート
  const [suggestedMovieTitles, setSuggestedMovieTitles] = useState<string[]>([]);
  // ★追加: 提案の読み込み状態
  const [loadingSuggestions, setLoadingSuggestions] = useState<boolean>(false);

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

  // ★追加: Gemini APIを呼び出して映画タイトルを提案する関数
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

      const result = await response.json();

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
        // ★変更: 検索結果がない場合にGemini APIを呼び出す
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

  // ★追加: 提案されたタイトルをクリックしたときのハンドラ
  const handleSuggestedTitleClick = (suggestedTitle: string) => {
    setMovieTitle(suggestedTitle); // 検索ボックスに提案されたタイトルを設定
    // フォームをプログラムで送信して新しい検索を開始
    const form = document.querySelector('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
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

      {/* ★追加: 提案された映画タイトルを表示 */}
      {!loading && !error && results.length === 0 && suggestedMovieTitles.length > 0 && (
        <div style={styles.suggestionsContainer}>
          <p style={styles.suggestionsLabel}>もしかして？</p>
          <ul style={styles.suggestionsList}>
            {suggestedMovieTitles.map((suggestion, index) => (
              <li key={index} style={styles.suggestionItem}>
                <button
                  type="button" // フォーム送信を防ぐ
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
                </li>
              ))}
            </ul>
          </>
        ) : (
          // ★変更: 検索結果がない場合でも、提案が表示される場合はこのメッセージを表示しない
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
  // ★追加: 提案表示用のスタイル
  suggestionsContainer: {
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f0f8ff', // 薄い青の背景
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
    backgroundColor: '#e0f7fa', // 薄いシアンのボタン
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
};
