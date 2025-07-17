'use client';

import { useState } from 'react';
import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRecentChats } from '@/hooks/useRecentChats';
import { RecentChatsSidebar } from '@/components/RecentChatsSidebar';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;

interface MovieData {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
}

interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

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
  const router = useRouter();
  const [movieTitle, setMovieTitle] = useState('');
  const [results, setResults] = useState<AppMovieResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { items: recentChats, loading: recentLoading, error: recentError } = useRecentChats(10, true);

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
        throw new Error(`映画検索に失敗しました: ${searchResponse.statusText}`);
      }
      const searchData: { results: MovieData[] } = await searchResponse.json();

      if (searchData.results && searchData.results.length > 0) {
        const moviesWithStreaming = await Promise.all(
          searchData.results.map(async (movie) => {
            try {
              const providersUrl = `${TMDB_BASE_URL}/movie/${movie.id}/watch/providers?api_key=${TMDB_API_KEY}`;
              const providersResponse = await fetch(providersUrl);

              let justWatchLink: string | undefined = undefined;
              let services: { name: string; logo: string; link?: string }[] = [];

              if (providersResponse.ok) {
                const providersData = await providersResponse.json();
                const jpProviders = providersData.results?.JP;

                justWatchLink = jpProviders?.link;

                const addServices = (providerList: Provider[] | undefined) => {
                  if (providerList) {
                    providerList.forEach((p) => {
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

                services = Array.from(new Map(services.map((item) => [item.name, item])).values());
              }

              return {
                id: movie.id,
                title: movie.title,
                release_date: movie.release_date,
                overview: movie.overview,
                poster_path: movie.poster_path,
                streamingServices: services,
                justWatchLink,
              };
            } catch {
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
          })
        );

        setResults(moviesWithStreaming);
      } else {
        setError('一致する映画が見つかりませんでした。');
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(`検索中にエラーが発生しました: ${err.message}`);
      } else {
        setError('予期せぬエラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col-reverse md:flex-row gap-6 p-4 max-w-7xl mx-auto w-full">
      <div className="flex-1 bg-white rounded-lg p-6 shadow">
        <h1 className="text-2xl font-bold mb-4 text-center">どのオンデマンドで観れる？</h1>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-2 mb-4">
          <input
            type="text"
            value={movieTitle}
            onChange={(e) => setMovieTitle(e.target.value)}
            placeholder="映画名を入力してください"
            className="border border-gray-300 rounded px-4 py-2 w-full sm:w-80"
            disabled={loading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? '検索中...' : '検索'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600">
          結果が出てこない場合はスペースなどを入れるか英語名で検索してみてください。
        </p>
        {error && <p className="text-red-500 mt-2 text-center">{error}</p>}
        <div className="mt-6">
          {results.length > 0 ? (
            <>
              <h2 className="text-xl font-semibold mb-4 text-center">検索結果</h2>
              {results.map((movie) => (
                <div key={movie.id} className="bg-white rounded-lg p-4 shadow mb-6 flex gap-4">
                  <div className="flex-shrink-0">
                    {movie.poster_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                        alt={movie.title}
                        width={130}
                        height={200}
                        className="rounded"
                      />
                    )}
                    <button
                      onClick={() => router.push(`/chat/${movie.id}`)}
                      className="mt-2 bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                    >
                      この映画について語る
                    </button>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
                      {movie.title}（{movie.release_date?.slice(0, 4)}）
                    </h3>
                    <p className="text-sm text-gray-700 mt-2">
                      {movie.overview?.slice(0, 200)}...
                    </p>
                    <div className="mt-2">
                      <strong>視聴可能サービス：</strong>
                      {movie.streamingServices?.length ? (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {movie.streamingServices.map((s, i) => (
                            <a
                              key={i}
                              href={s.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Image
                                src={`https://image.tmdb.org/t/p/w45${s.logo}`}
                                alt={s.name}
                                width={30}
                                height={30}
                                className="rounded border"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">現在、視聴可能なサービス情報は見つかりませんでした。</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            !loading && !error && (
              <p className="text-center text-gray-500">映画名を入力して検索してください。</p>
            )
          )}
        </div>
      </div>
      <div className="md:w-80 w-full bg-white rounded-lg p-4 shadow">
        <RecentChatsSidebar items={recentChats} loading={recentLoading} error={recentError} />
      </div>
    </main>
  );
}
