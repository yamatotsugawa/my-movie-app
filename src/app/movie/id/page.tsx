'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

type WatchProviderResponse = {
  id: number;
  results: {
    JP?: {
      flatrate?: Provider[];
      rent?: Provider[];
      buy?: Provider[];
    };
  };
};

export default function MovieDetailPage() {
  const { id } = useParams();
  const movieId = id as string;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovieData = async () => {
      try {
        const movieRes = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&language=ja-JP`
        );
        const movieJson = await movieRes.json();
        const movieData = movieJson as { title: string };
        setTitle(movieData.title);

        const providerRes = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
        );
        const providerJson = await providerRes.json();
        const providerData = providerJson as WatchProviderResponse;

        const jpProviders = providerData.results?.JP?.flatrate || [];
        setProviders(jpProviders);
      } catch (err) {
        console.error('データ取得エラー:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
  }, [movieId]);

  return (
    <div style={{ padding: 40 }}>
      <h1>{title || `映画ID: ${movieId}`}</h1>
      {loading ? (
        <p>読み込み中...</p>
      ) : providers.length === 0 ? (
        <p>現在日本で視聴可能な配信サービスは見つかりませんでした。</p>
      ) : (
        <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', padding: 0 }}>
          {providers.map((provider) => (
            <li key={provider.provider_id}>
              <img
                src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                alt={provider.provider_name}
                width={60}
                height={60}
              />
              <p>{provider.provider_name}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
