'use client';

import { useState, useEffect, useMemo } from 'react';

interface Product {
  id: number; sid: number; nm: string; img: string;
  pr: number; pMin: number; pMax: number; pOld: number; disc: string;
  sold: number; hist: number; like: number; rate: number; rv: number;
  sn: string; sl: string; off: boolean; pref: boolean;
  cat: string; catMid?: string; catBig: string; catId: number;
}

interface CountryMeta {
  country: string; name: string; domain: string; currency: string;
  supported: boolean; totalProducts: number; totalSellers: number; collected?: string;
  categories: { big: [string, number][]; mid: [string, number][]; small?: [string, number][] };
}

const COUNTRIES = [
  { code: 'sg', name: 'Singapore', flag: '🇸🇬' },
  { code: 'my', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'th', name: 'Thailand', flag: '🇹🇭' },
  { code: 'ph', name: 'Philippines', flag: '🇵🇭' },
  { code: 'tw', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'vn', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'br', name: 'Brazil', flag: '🇧🇷' },
  { code: 'mx', name: 'Mexico', flag: '🇲🇽' },
];

const KRW_RATES: Record<string, number> = {
  SGD: 1080, MYR: 330, THB: 42, PHP: 25, TWD: 45, VND: 0.058, BRL: 250, MXN: 75, KRW: 1,
};

function toKRW(amount: number, currency: string): string {
  const rate = KRW_RATES[currency] || 1;
  const krw = amount * rate;
  if (krw >= 100000000) return `₩${(krw / 100000000).toFixed(1)}억`;
  if (krw >= 10000) return `₩${(krw / 10000).toFixed(0)}만`;
  if (krw >= 1000) return `₩${(krw / 1000).toFixed(1)}천`;
  return `₩${Math.round(krw).toLocaleString()}`;
}

function imgUrl(key: string, country: string) {
  if (!key) return '';
  if (key.startsWith('http')) return key;
  const cc = country === 'tw' ? 'tw' : country === 'my' ? 'my' : country === 'th' ? 'th' :
    country === 'vn' ? 'vn' : country === 'ph' ? 'ph' : country === 'br' ? 'br' :
    country === 'mx' ? 'mx' : 'sg';
  return `https://down-${cc}.img.susercontent.com/file/${key}`;
}

function sellerThumbUrl(key: string, country: string) {
  if (!key) return '';
  if (key.startsWith('http')) return key;
  const cc = country === 'tw' ? 'tw' : country === 'my' ? 'my' : country === 'th' ? 'th' :
    country === 'vn' ? 'vn' : country === 'ph' ? 'ph' : country === 'br' ? 'br' :
    country === 'mx' ? 'mx' : 'sg';
  const id = key.replace(/_tn$/, '');
  return `https://down-${cc}.img.susercontent.com/file/${id}_tn`;
}

export default function Home() {
  const [activeCountry, setActiveCountry] = useState('sg');
  const [viewMode, setViewMode] = useState<'products' | 'sellers'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<CountryMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catBig, setCatBig] = useState('');
  const [catMid, setCatMid] = useState('');
  const [catSmall, setCatSmall] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [minSold, setMinSold] = useState(0);
  const [sortBy, setSortBy] = useState('sold');
  const [showMall, setShowMall] = useState<'all' | 'only' | 'exclude'>('all');
  const [showPref, setShowPref] = useState<'all' | 'only' | 'exclude'>('all');
  const [page, setPage] = useState(0);
  const pageSize = 200;

  // SG는 hist 필드가 있으므로 월 판매 가능, 나머지는 누적
  const isMonthly = activeCountry === 'sg';
  const soldLabel = isMonthly ? '/월' : '누적';
  const revLabel = isMonthly ? '월 예상 매출' : '누적 예상 매출';

  useEffect(() => {
    setLoading(true);
    setProducts([]); setMeta(null);
    setCatBig(''); setCatMid(''); setCatSmall('');
    setSearch(''); setPage(0);
    fetch(`/data/${activeCountry}.json`)
      .then(r => { if (!r.ok) throw new Error('no data'); return r.json(); })
      .then(data => { setProducts(data.products || []); setMeta(data.meta || null); setLoading(false); })
      .catch(() => { setProducts([]); setMeta(null); setLoading(false); });
  }, [activeCountry]);

  const bigCats = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => { const k = p.catBig || '기타'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const midCats = useMemo(() => {
    const filtered = catBig ? products.filter(p => p.catBig === catBig) : products;
    const map: Record<string, number> = {};
    filtered.forEach(p => { const k = p.catMid || p.cat || '기타'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [products, catBig]);

  const smallCats = useMemo(() => {
    let filtered = products;
    if (catBig) filtered = filtered.filter(p => p.catBig === catBig);
    if (catMid) filtered = filtered.filter(p => (p.catMid || p.cat) === catMid);
    const map: Record<string, number> = {};
    filtered.forEach(p => { const k = p.cat || ''; if (k.length > 0) map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [products, catBig, catMid]);

  const filtered = useMemo(() => {
    let list = products;
    if (search.trim()) {
      const terms = search.toLowerCase().trim().split(/\s+/);
      list = list.filter(p => {
        const combined = ((p.nm || '') + ' ' + (p.sn || '')).toLowerCase();
        return terms.every(term => combined.includes(term));
      });
    }
    if (catBig) list = list.filter(p => p.catBig === catBig);
    if (catMid) list = list.filter(p => (p.catMid || p.cat) === catMid);
    if (catSmall) list = list.filter(p => p.cat === catSmall);
    if (minSold > 0) list = list.filter(p => p.sold >= minSold);
    if (minPrice > 0) list = list.filter(p => p.pr >= minPrice);
    if (showMall === 'only') list = list.filter(p => p.off);
    if (showMall === 'exclude') list = list.filter(p => !p.off);
    if (showPref === 'only') list = list.filter(p => p.pref);
    if (showPref === 'exclude') list = list.filter(p => !p.pref);
    list = [...list].sort((a, b) => {
      if (sortBy === 'sold') return b.sold - a.sold;
      if (sortBy === 'price') return a.pr - b.pr;
      if (sortBy === 'price_desc') return b.pr - a.pr;
      if (sortBy === 'rating') return (b.rate || 0) - (a.rate || 0);
      if (sortBy === 'discount') return parseFloat(String(b.disc || '0')) - parseFloat(String(a.disc || '0'));
      return 0;
    });
    return list;
  }, [products, search, catBig, catMid, catSmall, minSold, minPrice, sortBy, showMall, showPref]);

  const sellerStats = useMemo(() => {
    if (!products.length) return [];
    const map: Record<string, {
      sid: number; sn: string; off: boolean; pref: boolean;
      totalSold: number; totalRevenue: number; items: number;
      topItem: { nm: string; sold: number; pr: number; img: string; id: number };
      categories: Record<string, number>;
    }> = {};
    products.forEach((p: any) => {
      const keyRaw = p.sid ?? p.sn;
      if (keyRaw === undefined || keyRaw === null || keyRaw === '') return;
      const key = String(keyRaw);
      const price = p.pr || p.pMin || 0;
      const sold = p.sold || 0;
      const revenue = price * sold;
      if (!map[key]) {
        map[key] = { sid: p.sid, sn: p.sn || '', off: p.off || false, pref: p.pref || false,
          totalSold: 0, totalRevenue: 0, items: 0,
          topItem: { nm: p.nm, sold, pr: price, img: p.img, id: p.id }, categories: {} };
      }
      const s = map[key];
      s.totalSold += sold; s.totalRevenue += revenue; s.items += 1;
      if (sold > s.topItem.sold) { s.topItem = { nm: p.nm, sold, pr: price, img: p.img, id: p.id }; }
      const cat = p.catBig || p.catMid || '기타';
      s.categories[cat] = (s.categories[cat] || 0) + 1;
    });
    return Object.values(map).filter(s => s.totalSold > 0).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [products]);

  const filteredSellers = useMemo(() => {
    let list = [...sellerStats];
    if (search.trim()) {
      const terms = search.toLowerCase().trim().split(/\s+/);
      list = list.filter(s => terms.every(t => (s.sn || '').toLowerCase().includes(t)));
    }
    if (showMall === 'only') list = list.filter(s => s.off);
    else if (showMall === 'exclude') list = list.filter(s => !s.off);
    if (showPref === 'only') list = list.filter(s => s.pref);
    else if (showPref === 'exclude') list = list.filter(s => !s.pref);
    return list;
  }, [sellerStats, search, showMall, showPref]);

  const sellerPage = filteredSellers.slice(page * pageSize, (page + 1) * pageSize);
  const paged = filtered.slice(0, (page + 1) * pageSize);
  const hasMore = paged.length < filtered.length;

  const handleBigChange = (v: string) => { setCatBig(v); setCatMid(''); setCatSmall(''); setPage(0); };
  const handleMidChange = (v: string) => { setCatMid(v); setCatSmall(''); setPage(0); };
  const handleSmallChange = (v: string) => { setCatSmall(v); setPage(0); };
  const toggleMall = () => { setShowMall(prev => (prev === 'all' ? 'only' : prev === 'only' ? 'exclude' : 'all')); setPage(0); };
  const togglePref = () => { setShowPref(prev => (prev === 'all' ? 'only' : prev === 'only' ? 'exclude' : 'all')); setPage(0); };

  const currency = meta?.currency || 'SGD';

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${activeCountry}_filtered_${filtered.length}.json`; a.click();
  };

  const downloadCSV = () => {
    const headers = ['rank','name','price','price_krw','sold','sold_type','revenue_krw','rating','reviews','seller','category_big','category_mid','category_small','url'];
    const rows = filtered.map((p, i) => {
      const rate = KRW_RATES[currency] || 1;
      return [i+1, `"${(p.nm||'').replace(/"/g,'""')}"`, p.pr, Math.round((p.pr||0)*rate),
        p.sold, isMonthly?'monthly':'cumulative', Math.round((p.pr||0)*(p.sold||0)*rate),
        p.rate?.toFixed(1)||'', p.rv, `"${(p.sn||'').replace(/"/g,'""')}"`,
        `"${p.catBig||''}"`, `"${p.catMid||''}"`, `"${p.cat||''}"`,
        `https://${meta?.domain||'shopee.sg'}/product/${p.sid}/${p.id}`];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${activeCountry}_filtered_${filtered.length}.csv`; a.click();
  };

  return (
    <main style={{ background: '#0a0a0f', minHeight: '100vh', color: '#fff', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <h1 style={{ margin: 0, fontSize: 28, color: '#ff6633' }}>Korea Top</h1>
        <p style={{ margin: '4px 0 16px', color: '#888', fontSize: 14 }}>
          🇰🇷{' '}
          {meta
            ? `${meta.totalProducts?.toLocaleString() ?? 0}개 | ${meta.totalSellers?.toLocaleString() ?? 0}셀러 | 수집 ${meta.collected ? new Date(meta.collected).toLocaleString('ko-KR') : '-'}`
            : '데이터 없음'}
          {!isMonthly && <span style={{ color: '#ff6633', marginLeft: 8, fontSize: 12 }}>⚠️ 누적 판매량 기준</span>}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '0 24px 16px', flexWrap: 'wrap' }}>
        {COUNTRIES.map(c => (
          <button key={c.code} type="button" onClick={() => setActiveCountry(c.code)}
            style={{
              padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
              background: activeCountry === c.code ? '#ff6633' : '#1a1a2e',
              color: activeCountry === c.code ? '#fff' : '#888',
              fontWeight: activeCountry === c.code ? 700 : 400,
            }}>
            {c.flag} {c.name}
            {activeCountry === c.code && meta ? ` (${meta.totalProducts?.toLocaleString() ?? 0})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>로딩중...</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
          {activeCountry.toUpperCase()} 데이터가 없습니다. 수집 후 업로드하세요.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, padding: '0 24px 16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="상품명, 셀러명..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', width: 160, fontSize: 13 }} />

            <select value={catBig} onChange={e => handleBigChange(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13 }}>
              <option value="">전체 대분류</option>
              {bigCats.map(([name, cnt]) => (<option key={name} value={name}>{name} ({cnt})</option>))}
            </select>

            <select value={catMid} onChange={e => handleMidChange(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13 }}>
              <option value="">전체 중분류</option>
              {midCats.map(([name, cnt]) => (<option key={name} value={name}>{name} ({cnt})</option>))}
            </select>

            {smallCats.length > 1 && (
              <select value={catSmall} onChange={e => handleSmallChange(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13 }}>
                <option value="">전체 소분류 ({smallCats.reduce((s, c) => s + c[1], 0)})</option>
                {smallCats.map(([name, cnt]) => (<option key={name} value={name}>{name} ({cnt})</option>))}
              </select>
            )}

            <input type="number" placeholder={`최소 가격 (${currency})`}
              value={minPrice || ''}
              onChange={e => { setMinPrice(Number(e.target.value) || 0); setPage(0); }}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', width: 130, fontSize: 13 }} />

            <select value={String(minSold)} onChange={e => { setMinSold(Number(e.target.value)); setPage(0); }}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13 }}>
              <option value="0">전체</option>
              <option value="10">10+{soldLabel}</option>
              <option value="50">50+{soldLabel}</option>
              <option value="100">100+{soldLabel}</option>
              <option value="500">500+{soldLabel}</option>
              <option value="1000">1000+{soldLabel}</option>
            </select>

            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(0); }}
              style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13 }}>
              <option value="sold">판매순</option>
              <option value="price">가격 낮은순</option>
              <option value="price_desc">가격 높은순</option>
              <option value="rating">평점순</option>
              <option value="discount">할인율순</option>
            </select>

            <button type="button" onClick={toggleMall}
              style={{ padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                background: showMall === 'only' ? '#ff6633' : showMall === 'exclude' ? '#333' : '#1a1a2e',
                color: showMall === 'all' ? '#888' : '#fff',
                textDecoration: showMall === 'exclude' ? 'line-through' : 'none' }}>
              {showMall === 'only' ? 'Mall직영' : showMall === 'exclude' ? 'Mall제외' : 'Mall 직영'}
            </button>

            <button type="button" onClick={togglePref}
              style={{ padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13,
                background: showPref === 'only' ? '#ff6633' : showPref === 'exclude' ? '#333' : '#1a1a2e',
                color: showPref === 'all' ? '#888' : '#fff',
                textDecoration: showPref === 'exclude' ? 'line-through' : 'none' }}>
              {showPref === 'only' ? 'Preferred' : showPref === 'exclude' ? 'Pref제외' : 'Preferred'}
            </button>

            <button type="button" onClick={downloadJSON}
              style={{ padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: '#1565c0', color: '#fff' }}>
              📥 JSON
            </button>
            <button type="button" onClick={downloadCSV}
              style={{ padding: '8px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: '#c62828', color: '#fff' }}>
              📥 CSV
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, padding: '0 24px' }}>
            <button type="button" onClick={() => { setViewMode('products'); setPage(0); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: viewMode === 'products' ? '#ff6633' : '#1a1a2e',
                color: viewMode === 'products' ? '#fff' : '#888' }}>
              🛍️ 상품별
            </button>
            <button type="button" onClick={() => { setViewMode('sellers'); setPage(0); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                background: viewMode === 'sellers' ? '#ff6633' : '#1a1a2e',
                color: viewMode === 'sellers' ? '#fff' : '#888' }}>
              🏪 셀러별 매출
            </button>
          </div>

          {viewMode === 'sellers' ? (
            <div style={{ padding: '0 24px 24px' }}>
              <p style={{ color: '#aaa', marginBottom: 12, fontSize: 13 }}>
                표시 {Math.min((page + 1) * pageSize, filteredSellers.length)} / {filteredSellers.length}개 셀러
                {' '}| 총 {revLabel} {currency}{' '}
                {filteredSellers.reduce((sum, x) => sum + x.totalRevenue, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                <span style={{ color: '#ff6633', marginLeft: 8 }}>
                  ({toKRW(filteredSellers.reduce((sum, x) => sum + x.totalRevenue, 0), currency)})
                </span>
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sellerPage.map((s, i) => {
                  const rank = page * pageSize + i + 1;
                  const topCats = Object.entries(s.categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(c => c[0]);
                  const domain = meta?.domain || 'shopee.sg';
                  const shopUrl = `https://${domain}/shop/${s.sid}`;
                  const itemUrl = `https://${domain}/product/${s.sid}/${s.topItem.id}`;

                  return (
                    <a key={s.sid} href={shopUrl} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: 16,
                        background: rank <= 3 ? 'linear-gradient(135deg, #1a1a2e, #2a1a1e)' : '#1a1a2e',
                        borderRadius: 12, textDecoration: 'none', color: '#fff',
                        border: rank <= 3 ? '1px solid #ff663344' : '1px solid #333',
                        transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(255,102,51,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
                    >
                      <div style={{
                        minWidth: 44, height: 44, borderRadius: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: rank === 1 ? '#ff6633' : rank === 2 ? '#ff8855' : rank === 3 ? '#ffaa77' : '#333',
                        color: rank <= 3 ? '#fff' : '#888', fontWeight: 800, fontSize: rank <= 3 ? 18 : 15,
                      }}>
                        #{rank}
                      </div>

                      <div style={{ position: 'relative', minWidth: 64, height: 64 }}>
                        {s.topItem.img && (
                          <img src={sellerThumbUrl(s.topItem.img, activeCountry)} alt=""
                            style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          {s.off && (<span style={{ background: '#ff3333', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Mall</span>)}
                          {s.pref && (<span style={{ background: '#ff8800', color: '#fff', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Preferred</span>)}
                          <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sn}</span>
                        </div>
                        <div onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(itemUrl, '_blank'); }}
                          style={{ fontSize: 12, color: '#aaa', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                          title={s.topItem.nm}>
                          🏆 {s.topItem.nm}
                          <span style={{ color: '#ff6633', marginLeft: 6 }}>({s.topItem.sold.toLocaleString()}{soldLabel})</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {topCats.map(cat => (
                            <span key={cat} style={{ fontSize: 10, background: '#2a2a4a', color: '#888', padding: '2px 6px', borderRadius: 4 }}>{cat}</span>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: 140 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#ff6633' }}>
                          {currency}{' '}
                          {s.totalRevenue >= 10000 ? `${(s.totalRevenue / 1000).toFixed(0)}K` : s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#ffaa33', marginTop: 1 }}>
                          {toKRW(s.totalRevenue, currency)}
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>{revLabel}</div>
                        <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                          🔥 {s.totalSold.toLocaleString()}{soldLabel} · 📦 {s.items}개 상품
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>

              {filteredSellers.length > pageSize && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                  <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: page === 0 ? '#333' : '#ff6633', color: '#fff', cursor: page === 0 ? 'default' : 'pointer' }}>
                    ◀ 이전
                  </button>
                  <span style={{ color: '#aaa', lineHeight: '36px', fontSize: 13 }}>
                    {page + 1} / {Math.ceil(filteredSellers.length / pageSize)}
                  </span>
                  <button type="button" disabled={(page + 1) * pageSize >= filteredSellers.length} onClick={() => setPage(p => p + 1)}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: (page + 1) * pageSize >= filteredSellers.length ? '#333' : '#ff6633', color: '#fff', cursor: (page + 1) * pageSize >= filteredSellers.length ? 'default' : 'pointer' }}>
                    다음 ▶
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ padding: '0 24px 12px', color: '#888', fontSize: 13 }}>
                표시 {paged.length.toLocaleString()} / {filtered.length.toLocaleString()}개
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: '0 24px 24px' }}>
                {paged.map((p, i) => (
                  <a key={`${p.id}-${i}`} href={`https://${meta?.domain || 'shopee.sg'}/product/${p.sid}/${p.id}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ background: '#12121a', borderRadius: 10, overflow: 'hidden', textDecoration: 'none', color: '#fff', position: 'relative', border: '1px solid #1a1a2e' }}>
                    {i < 3 && (
                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        background: i === 0 ? '#ff6633' : i === 1 ? '#ff8f00' : '#ff6633',
                        color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, zIndex: 1,
                      }}>#{i + 1}</div>
                    )}
                    <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 1 }}>
                      {p.off && (<span style={{ background: '#c62828', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>Mall</span>)}
                      {p.pref && (<span style={{ background: '#1565c0', padding: '2px 6px', borderRadius: 4, fontSize: 10 }}>Pref</span>)}
                    </div>
                    <div style={{ width: '100%', paddingTop: '100%', position: 'relative', background: '#1a1a2e' }}>
                      <img src={imgUrl(p.img, activeCountry)} alt="" loading="lazy"
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div style={{ padding: '10px 10px 12px' }}>
                      <div style={{ fontSize: 12, lineHeight: 1.4, height: 34, overflow: 'hidden', color: '#ccc' }}>{p.nm}</div>
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ color: '#ff6633', fontWeight: 700, fontSize: 15 }}>
                          {currency} {(p.pr || 0).toFixed(2)}
                        </span>
                        {p.disc ? <span style={{ color: '#ff3366', fontSize: 11 }}>-{p.disc}</span> : null}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 11, color: '#ffaa33' }}>
                        {toKRW(p.pr || 0, currency)}
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>
                        🔥 {(p.sold || 0).toLocaleString()}{soldLabel} | ⭐ {p.rate?.toFixed(1) || '-'}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 10, color: '#666', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        🏪 {p.sn} · 🇰🇷 {p.sl}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 10, color: '#555', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        📁 {p.catBig} &gt; {p.catMid || p.cat}
                        {p.cat && p.cat !== p.catMid && p.cat !== p.catBig ? ` > ${p.cat}` : ''}
                      </div>
                    </div>
                  </a>
                ))}
              </div>

              {hasMore && (
                <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
                  <button type="button" onClick={() => setPage(page + 1)}
                    style={{ padding: '12px 40px', borderRadius: 8, border: 'none', cursor: 'pointer', background: '#ff6633', color: '#fff', fontSize: 15, fontWeight: 700 }}>
                    더 보기 ({filtered.length - paged.length}개 남음)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
