import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Bell, RefreshCw, Settings, X, TrendingUp, TrendingDown } from 'lucide-react';

export default function GeoPoliticalDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(!localStorage.getItem('newsApiKey'));
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [breakingStories, setBreakingStories] = useState([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [biasCache, setBiasCache] = useState({});
  const previousArticlesRef = useRef(new Set());

  // Bias color scheme
  const biasColors = {
    'Left': 'from-blue-600 to-blue-700',
    'Center-Left': 'from-blue-500 to-slate-500',
    'Center': 'from-slate-500 to-slate-600',
    'Center-Right': 'from-red-500 to-slate-500',
    'Right': 'from-red-600 to-red-700',
    'Pro-Science': 'from-green-600 to-green-700',
    'Questionable': 'from-yellow-600 to-orange-600',
    'Conspiracy': 'from-orange-600 to-red-600'
  };

  const credibilityColor = {
    'Very High': 'bg-green-950 text-green-200 border-green-800',
    'High': 'bg-green-950 text-green-200 border-green-800',
    'Mostly Factual': 'bg-blue-950 text-blue-200 border-blue-800',
    'Mixed': 'bg-yellow-950 text-yellow-200 border-yellow-800',
    'Low': 'bg-red-950 text-red-200 border-red-800',
    'Satire': 'bg-purple-950 text-purple-200 border-purple-800'
  };

  // Initialize API key from storage
  useEffect(() => {
    const stored = localStorage.getItem('newsApiKey');
    if (stored) {
      setApiKey(stored);
      setShowApiModal(false);
    }
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') setNotificationsEnabled(true);
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const saveApiKey = (key) => {
    localStorage.setItem('newsApiKey', key);
    setApiKey(key);
    setShowApiModal(false);
  };

  const fetchBiasData = async (sourceName) => {
    // Check cache first
    if (biasCache[sourceName]) {
      return biasCache[sourceName];
    }

    try {
      // Media Bias/Fact Check API - free endpoint
      const response = await fetch(
        `https://api.mediabiasfactcheck.com/api/v1/search?query=${encodeURIComponent(sourceName)}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const source = data.results[0];
        const biasData = {
          bias: source.bias || 'Unknown',
          credibility: source.credibility || 'Unknown',
          factual: source.factual || 'Unknown',
          mbfc_url: source.url,
          notes: source.notes || ''
        };
        
        // Cache it
        setBiasCache(prev => ({ ...prev, [sourceName]: biasData }));
        return biasData;
      }
    } catch (error) {
      console.error('Bias check error:', error);
    }
    return null;
  };

  const fetchNews = async (keyToUse = apiKey) => {
    if (!keyToUse) {
      setShowApiModal(true);
      return;
    }

    setLoading(true);
    try {
      // Geopolitical keywords that matter for business/supply chain risk
      const geoKeywords = [
        'war',
        'conflict',
        'sanctions',
        'geopolitical',
        'trade',
        'exports',
        'tariff',
        'Ukraine',
        'China',
        'Taiwan',
        'Russia',
        'NATO',
        'Middle East',
        'supply chain',
        'embargo'
      ];

      const query = geoKeywords.join(' OR ');
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=30&apiKey=${keyToUse}`
      );

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      const sortedArticles = (data.articles || [])
        .filter(a => a.title && a.description && a.urlToImage)
        .slice(0, 20);

      // Detect new/breaking stories
      const currentIds = new Set(sortedArticles.map(a => a.url));
      const newStories = sortedArticles.filter(a => !previousArticlesRef.current.has(a.url));
      
      if (newStories.length > 0) {
        setBreakingStories(newStories);
        // Auto-clear breaking indicator after 30 seconds
        setTimeout(() => setBreakingStories([]), 30000);

        // Send notification
        if (notificationsEnabled && newStories.length > 0) {
          new Notification('Breaking Geopolitical News', {
            body: newStories[0].title,
            icon: '🚨'
          });
        }
      }

      previousArticlesRef.current = currentIds;
      setArticles(sortedArticles);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Fetch error:', error);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (apiKey && !showApiModal) {
      fetchNews();
      const interval = setInterval(() => fetchNews(), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [apiKey, showApiModal]);

  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const secondsAgo = Math.floor((now - date) / 1000);
    
    if (secondsAgo < 60) return 'just now';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
    return `${Math.floor(secondsAgo / 86400)}d ago`;
  };

  return <DashboardContent 
    apiKey={apiKey}
    showApiModal={showApiModal}
    setShowApiModal={setShowApiModal}
    saveApiKey={saveApiKey}
    articles={articles}
    loading={loading}
    lastUpdate={lastUpdate}
    breakingStories={breakingStories}
    fetchNews={fetchNews}
    fetchBiasData={fetchBiasData}
    biasCache={biasCache}
    timeAgo={timeAgo}
    biasColors={biasColors}
    credibilityColor={credibilityColor}
  />;
}

function ArticleCard({ article, isBreaking, bias, biasColors, credibilityColor, timeAgo, onLoadBias }) {
  const [showBias, setShowBias] = React.useState(false);
  const [loadingBias, setLoadingBias] = React.useState(false);

  const handleLoadBias = async () => {
    setLoadingBias(true);
    await onLoadBias();
    setShowBias(true);
    setLoadingBias(false);
  };

  return (
    <article
      className={`border rounded-lg overflow-hidden hover:border-slate-600 transition-colors ${
        isBreaking
          ? 'border-red-800 bg-red-950/20'
          : 'border-slate-800 bg-slate-900/50'
      }`}
    >
      <div className="flex gap-4 p-4">
        {article.urlToImage && (
          <img
            src={article.urlToImage}
            alt=""
            className="w-32 h-32 object-cover rounded flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold leading-tight">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 transition-colors"
              >
                {article.title}
              </a>
            </h3>
            {isBreaking && (
              <span className="flex-shrink-0 px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded">
                BREAKING
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3 line-clamp-2">
            {article.description}
          </p>

          {/* Bias & Credibility Section */}
          {showBias && bias ? (
            <BiasGauge bias={bias} biasColors={biasColors} credibilityColor={credibilityColor} />
          ) : (
            <button
              onClick={handleLoadBias}
              disabled={loadingBias}
              className="text-xs text-slate-400 hover:text-slate-200 mb-2 disabled:opacity-50 transition-colors"
            >
              {loadingBias ? '⏳ Checking bias...' : '📊 Check source bias'}
            </button>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{article.source.name}</span>
            <span>{timeAgo(article.publishedAt)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function BiasGauge({ bias, biasColors, credibilityColor }) {
  const biasScale = {
    'Left': -2,
    'Center-Left': -1,
    'Center': 0,
    'Center-Right': 1,
    'Right': 2,
    'Pro-Science': 0,
    'Questionable': -999,
    'Conspiracy': -999
  };

  const biasPosition = biasScale[bias.bias] || 0;
  const isReliable = ['Very High', 'High', 'Mostly Factual'].includes(bias.credibility);

  return (
    <div className="mb-3 space-y-2">
      {/* Bias Spectrum Gauge */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-semibold text-slate-300">Political Lean</span>
          <span className={`text-xs px-2 py-1 rounded border ${biasColors[bias.bias] ? 'bg-gradient-to-r ' + biasColors[bias.bias] + ' text-white' : 'text-slate-400'}`}>
            {bias.bias || 'Unknown'}
          </span>
        </div>
        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-blue-900/30"></div>
            <div className="flex-1 bg-slate-700/30"></div>
            <div className="flex-1 bg-red-900/30"></div>
          </div>
          {biasPosition !== -999 && (
            <div
              className={`absolute top-0 h-full w-1 bg-white rounded-full transition-all ${
                isReliable ? 'opacity-100' : 'opacity-50'
              }`}
              style={{
                left: `${50 + (biasPosition / 2) * 33}%`,
                transform: 'translateX(-50%)'
              }}
            ></div>
          )}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>← Left</span>
          <span>Center</span>
          <span>Right →</span>
        </div>
      </div>

      {/* Credibility Rating */}
      <div>
        <span className="text-xs font-semibold text-slate-300 block mb-1">Credibility</span>
        <span className={`text-xs px-2.5 py-1 rounded border ${credibilityColor[bias.credibility] || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
          {bias.credibility || 'Unknown'}
        </span>
      </div>

      {/* Warning indicators */}
      {!isReliable && (
        <div className="bg-yellow-950/30 border border-yellow-800 rounded px-2 py-1">
          <p className="text-xs text-yellow-200">⚠️ Exercise caution: Source credibility is mixed or low</p>
        </div>
      )}

      {bias.notes && (
        <div className="bg-slate-800/50 rounded px-2 py-1">
          <p className="text-xs text-slate-300">{bias.notes}</p>
        </div>
      )}
    </div>
  );
}

function DashboardContent({ apiKey, showApiModal, setShowApiModal, saveApiKey, articles, loading, lastUpdate, breakingStories, fetchNews, fetchBiasData, biasCache, timeAgo, biasColors, credibilityColor }) {

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Geopolitical Watch</h1>
            <p className="text-sm text-slate-400">Real-time intelligence briefing</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fetchNews()}
              disabled={loading}
              className="p-2 hover:bg-slate-800 rounded transition-colors disabled:opacity-50"
              title="Refresh now"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowApiModal(true)}
              className="p-2 hover:bg-slate-800 rounded transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
        {lastUpdate && (
          <div className="max-w-5xl mx-auto px-4 pb-3 text-xs text-slate-500">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </header>

      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-lg p-6 max-w-md w-full border border-slate-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Setup News API</h2>
              <button
                onClick={() => setShowApiModal(false)}
                className="p-1 hover:bg-slate-800 rounded"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-300 mb-4">
              Get a free API key from <a href="https://newsapi.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">newsapi.org</a> (takes 30 seconds).
            </p>
            <input
              type="text"
              placeholder="Paste your NewsAPI key here"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData('text');
                setApiKey(pastedText);
              }}
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => saveApiKey(apiKey)}
              disabled={!apiKey}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded px-4 py-2 font-medium transition-colors"
            >
              Save & Load News
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Breaking Alert Banner */}
        {breakingStories.length > 0 && (
          <div className="mb-6 p-4 bg-red-950 border border-red-800 rounded-lg flex gap-3 animate-pulse">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-red-200">Breaking News</p>
              <p className="text-sm text-red-100">{breakingStories[0].title}</p>
            </div>
          </div>
        )}

        {/* News Grid */}
        {loading && articles.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="inline-block animate-spin mb-2">
              <RefreshCw size={24} />
            </div>
            <p>Fetching intelligence...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p>No articles loaded. Check your API key.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article, idx) => {
              const isBreaking = breakingStories.some(s => s.url === article.url);
              const bias = biasCache[article.source.name];
              
              return (
                <ArticleCard
                  key={idx}
                  article={article}
                  isBreaking={isBreaking}
                  bias={bias}
                  biasColors={biasColors}
                  credibilityColor={credibilityColor}
                  timeAgo={timeAgo}
                  onLoadBias={() => fetchBiasData(article.source.name)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
        }
