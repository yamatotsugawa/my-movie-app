// src/app/page.tsx

'use client';

import { useState } from 'react';
import React from 'react';
// import Link from 'next/link'; // ★修正: Linkコンポーネントはもう使わないので削除

// TMDB APIのベースURL
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
// APIキーは環境変数から取得
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

// ★追加: 映画データの型定義
interface MovieData {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  // 以下はAPIレスポンスのプロパティ
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

// ★追加: ストリーミングサービスプロバイダーの型定義
interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

// ★追加: アプリ内で使用する映画結果の型定義
interface AppMovieResult {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  streamingServices?: { name: string; logo: string; link?: string }[];
  justWatchLink?: string;
}

export default function Home() {
  const [movieTitle, setMovieTitle] = useState<string>('');
  const [results, setResults] = useState<AppMovieResult[]>([]); // ★修正: AppMovieResult[] 型を使用
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 各オンデマンドサービスへのリンクを生成するヘルパー関数
  const getServiceSpecificLink = (providerName: string, movieTitle: string, justWatchMovieLink?: string): string => {
    switch (providerName) {
      case 'Amazon Prime Video':
        return `https://www.amazon.co.jp/s?k=${encodeURIComponent(movieTitle)}&i=instant-video`;
      case 'Netflix':
        return 'https://www.netflix.com/jp/';
      case 'U-NEXT':
        return 'https://video.unext.jp/';
      case 'Hulu':
        return 'https://www.hulu.jp/';
      case 'Disney Plus':
        return 'https://www.disneyplus.com/ja-jp';
      case 'Apple TV':
        return `https://tv.apple.com/jp/search/${encodeURIComponent(movieTitle)}`;
      case 'Google Play Movies':
        return `https://play.google.com/store/search?q=${encodeURIComponent(movieTitle)}&c=movies`;
      case 'YouTube':
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(movieTitle)}+full+movie`;
      default:
        return justWatchMovieLink || '#';
    }
  };


  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError(null);
    setResults([]);

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
      const searchData: { results: MovieData[] } = await searchResponse.json(); // ★修正: 型を明示

      if (searchData.results && searchData.results.length > 0) {
        const moviesWithStreamingPromises = searchData.results.map(async (movie: MovieData) => { // ★修正: movieの型をMovieDataに
          try {
            const providersUrl = `${TMDB_BASE_URL}/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`;
            const providersResponse = await fetch(providersUrl);

            let justWatchLink: string | undefined = undefined;
            let services: { name: string; logo: string; link?: string }[] = [];

            if (providersResponse.ok) {
              const providersData: { results: { JP?: { link?: string; flatrate?: Provider[]; buy?: Provider[]; rent?: Provider[] } } } = await providersResponse.json(); // ★修正: 型を明示
              const jpProviders = providersData.results?.JP;

              justWatchLink = jpProviders?.link;

              const addServices = (providerList: Provider[] | undefined) => { // ★修正: providerListの型を明示
                if (providerList) {
                  providerList.forEach((p: Provider) => { // ★修正: pの型をProviderに
                    services.push({
                      name: p.provider_name,
                      logo: p.logo_path,
                      link: getServiceSpecificLink(p.provider_name, movie.title, justWatchLink),
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
          } catch (providerError: any) {
            console.error(`視聴プロバイダー情報の取得中にエラーが発生しました (映画ID: ${movie.id}):`, providerError);
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
      }

    } catch (err: any) {
      console.error('映画検索エラー:', err);
      setError(`映画の検索中にエラーが発生しました: ${err.message}`);
    } finally {
      setLoading(false);
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

      <div style={styles.resultsContainer}>
        {results.length > 0 ? (
          <>
            <h2 style={styles.resultsTitle}>検索結果</h2>
            <ul style={styles.resultsList}>
              {results.map((movie: AppMovieResult) => ( // ★修正: movieの型をAppMovieResultに
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
                                    rel="noopener noreferrer"
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
          !loading && !error && <p style={styles.noResults}>映画名を入力して検索してください。</p>
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
};
