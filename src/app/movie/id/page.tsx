// src/app/movie/[id]/page.tsx

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import React from 'react';
import Link from 'next/link';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

export default function MovieDetailPage() {
  const params = useParams();
  const movieId = params.id;
  const [movie, setMovie] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      if (!movieId) {
        setLoading(false);
        setError('映画IDが見つかりません。');
        return;
      }

      if (!TMDB_API_KEY) {
        setLoading(false);
        setError('APIキーが設定されていません。`.env.local`を確認してください。');
        return;
      }

      try {
        const url = `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ja-JP&append_to_response=videos,credits,watch/providers`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API呼び出しに失敗しました: ${response.statusText}`);
        }
        const data = await response.json();
        setMovie(data);
        console.log('TMDB詳細データ:', data);
      } catch (err: any) {
        console.error('映画詳細取得エラー:', err);
        setError(`映画詳細の取得中にエラーが発生しました: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [movieId]);

  if (loading) {
    return <p style={styles.loading}>映画情報を読み込み中...</p>;
  }

  if (error) {
    return <p style={styles.errorText}>{error}</p>;
  }

  if (!movie) {
    return <p style={styles.noData}>映画情報が見つかりません。</p>;
  }

  const streamingInfo = movie['watch/providers']?.results['JP']?.flatrate || [];
  const buyInfo = movie['watch/providers']?.results['JP']?.buy || [];
  const rentInfo = movie['watch/providers']?.results['JP']?.rent || [];

  return (
    <div style={styles.container}>
      <Link href="/" style={styles.backLink}>← 検索に戻る</Link>
      <h1 style={styles.title}>{movie.title}</h1>
      <div style={styles.movieDetailContent}>
        {movie.poster_path && (
          <img
            src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
            alt={movie.title}
            style={styles.detailPoster}
          />
        )}
        <div style={styles.detailTextContent}>
          <p style={styles.detailReleaseDate}>公開日: {movie.release_date || '不明'}</p>
          {movie.genres && movie.genres.length > 0 && (
            <p style={styles.detailGenres}>ジャンル: {movie.genres.map((g: any) => g.name).join(', ')}</p>
          )}
          {movie.runtime && <p style={styles.detailRuntime}>上映時間: {movie.runtime}分</p>}
          {movie.vote_average > 0 && (
            <p style={styles.detailRating}>評価: {movie.vote_average.toFixed(1)} / 10 ({movie.vote_count}票)</p>
          )}
          <p style={styles.detailOverview}>{movie.overview || '概要はありません。'}</p>

          <h2 style={styles.streamingTitle}>視聴可能サービス (TMDB情報)</h2>
          {streamingInfo.length > 0 && (
            <div>
              <h3 style={styles.streamingSubtitle}>サブスクリプション:</h3>
              <ul style={styles.streamingList}>
                {streamingInfo.map((provider: any) => (
                  <li key={provider.provider_id} style={styles.streamingItem}>
                    {provider.logo_path && (
                      <img src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`} alt={provider.provider_name} style={styles.providerLogo} />
                    )}
                    {provider.provider_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {buyInfo.length > 0 && (
            <div>
              <h3 style={styles.streamingSubtitle}>購入:</h3>
              <ul style={styles.streamingList}>
                {buyInfo.map((provider: any) => (
                  <li key={provider.provider_id} style={styles.streamingItem}>
                    {provider.logo_path && (
                      <img src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`} alt={provider.provider_name} style={styles.providerLogo} />
                    )}
                    {provider.provider_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rentInfo.length > 0 && (
            <div>
              <h3 style={styles.streamingSubtitle}>レンタル:</h3>
              <ul style={styles.streamingList}>
                {rentInfo.map((provider: any) => (
                  <li key={provider.provider_id} style={styles.streamingItem}>
                    {provider.logo_path && (
                      <img src={`https://image.tmdb.org/t/p/w45${provider.logo_path}`} alt={provider.provider_name} style={styles.providerLogo} />
                    )}
                    {provider.provider_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {streamingInfo.length === 0 && buyInfo.length === 0 && rentInfo.length === 0 && (
            <p style={styles.noStreamingInfo}>TMDBでは視聴情報が見つかりませんでした。</p>
          )}
          {movie['watch/providers']?.results['JP']?.link && (
            <p style={styles.justWatchLink}>
              より詳細な視聴情報は <a href={movie['watch/providers'].results['JP'].link} target="_blank" rel="noopener noreferrer">JustWatch (TMDB提供リンク)</a> で確認してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// スタイルの追加と修正
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    fontFamily: 'Arial, sans-serif',
    maxWidth: '900px',
    margin: '40px auto',
    padding: '30px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    backgroundColor: '#fff',
  },
  backLink: {
    display: 'inline-block',
    marginBottom: '20px',
    color: '#0070f3',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '30px',
    fontSize: '2em',
  },
  loading: {
    textAlign: 'center',
    fontSize: '1.2em',
    color: '#555',
    margin: '50px',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    margin: '50px',
  },
  noData: {
    textAlign: 'center',
    color: '#999',
    margin: '50px',
  },
  movieDetailContent: {
    display: 'flex',
    flexDirection: 'column', // デフォルトで縦並び
    alignItems: 'center',
    gap: '25px',
    // @media クエリはインラインスタイルでは直接記述できないため、完全に削除
    // レスポンシブ対応が必要な場合は、外部CSSファイル（例: page.module.css）を利用してください。
  },
  detailPoster: {
    width: '100%',
    maxWidth: '300px',
    height: 'auto',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
  },
  detailTextContent: {
    flex: 1,
    width: '100%',
  },
  detailReleaseDate: {
    fontSize: '1.1em',
    color: '#555',
    marginBottom: '10px',
  },
  detailGenres: {
    fontSize: '1.1em',
    color: '#555',
    marginBottom: '10px',
  },
  detailRuntime: {
    fontSize: '1.1em',
    color: '#555',
    marginBottom: '10px',
  },
  detailRating: {
    fontSize: '1.1em',
    color: '#555',
    marginBottom: '20px',
  },
  detailOverview: {
    fontSize: '1em',
    lineHeight: '1.6',
    color: '#444',
    marginBottom: '30px',
  },
  streamingTitle: {
    fontSize: '1.5em',
    color: '#333',
    marginTop: '20px',
    marginBottom: '15px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  },
  streamingSubtitle: {
    fontSize: '1.2em',
    color: '#555',
    marginTop: '15px',
    marginBottom: '10px',
  },
  streamingList: {
    listStyle: 'none',
    padding: '0',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  streamingItem: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#eef',
    padding: '8px 12px',
    borderRadius: '20px',
    border: '1px solid #ccd',
    fontSize: '0.9em',
    color: '#333',
  },
  providerLogo: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    marginRight: '8px',
  },
  noStreamingInfo: {
    color: '#888',
    fontStyle: 'italic',
    marginTop: '10px',
  },
  justWatchLink: {
    marginTop: '20px',
    fontSize: '0.9em',
    color: '#666',
  }
};