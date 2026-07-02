
import { useState, useEffect, useRef, useCallback } from 'react'

// ═══════════════════════════════════════════
// AUTO-REFRESH HOOK — keeps data fresh at high refresh rate
// Polls API every `interval` ms (default 30s)
// Only when tab is visible (saves resources)
// ═══════════════════════════════════════════
export function useAutoRefresh(fetchFn, interval = 30000) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const fetchRef = useRef(fetchFn)
  const intervalRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => { fetchRef.current = fetchFn }, [fetchFn])

  const execute = useCallback(async () => {
    try {
      const result = await fetchRef.current()
      if (mountedRef.current) {
        setData(result)
        setLastRefresh(Date.now())
        setLoading(false)
      }
    } catch (err) {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true
    execute()
    return () => { mountedRef.current = false }
  }, [execute])

  // Auto-refresh interval - only when tab is visible
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          execute()
        }
      }, interval)
    }

    const stopInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    startInterval()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        execute() // Immediate refresh when tab becomes visible
        startInterval()
      } else {
        stopInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopInterval()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [interval, execute])

  const refresh = useCallback(() => {
    setLoading(true)
    return execute()
  }, [execute])

  return { data, loading, lastRefresh, refresh }
}

// ═══════════════════════════════════════════
// ANIMATED COUNTER HOOK — smooth number counting
// ═══════════════════════════════════════════
export function useAnimatedCounter(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = performance.now()
    const startVal = value

    const update = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = Math.floor(startVal + (target - startVal) * eased)
      setValue(current)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(update)
      }
    }

    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])

  return value
}

export function numberToWords(num) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
    'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  
  function inW(n) {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' '+a[n%10] : '');
    if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+inW(n%100) : '');
    if (n < 100000) return inW(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+inW(n%1000) : '');
    if (n < 10000000) return inW(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+inW(n%100000) : '');
    return inW(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+inW(n%10000000) : '');
  }
  
  const rupees = Math.round(Math.floor(num));
  const paise = Math.round((num - Math.floor(num)) * 100);
  let result = inW(rupees) + ' Rupees';
  if (paise > 0) result += ' and ' + inW(paise) + ' Paise';
  return result + ' Only';
}

export function numberToWordsCaps(num) {
  return numberToWords(num).toUpperCase().replace('RUPEES ', '').replace(' RUPEES', '');
}

export function formatIndian(num) {
  if (num === null || num === undefined || isNaN(num)) return '0.00';
  const n = parseFloat(num);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

export function getFY(date = new Date()) {
  const m = date.getMonth();
  const y = date.getFullYear();
  if (m < 3) return `${(y - 1) % 100}-${y % 100}`;
  return `${y % 100}-${(y + 1) % 100}`;
}

export function parseGSTIN(gstin) {
  const STATE_CODES = {
    '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
    '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
    '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
    '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
    '20':'Jharkhand','21':'Odisha','22':'Chattisgarh','23':'Madhya Pradesh',
    '24':'Gujarat','25':'Daman & Diu','26':'Dadra & Nagar Haveli','27':'Maharashtra',
    '28':'Andhra Pradesh','29':'Karnataka','30':'Goa','31':'Lakshadweep',
    '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman & Nicobar',
    '36':'Telangana','37':'Ladakh','38':'Other Territory'
  };
  const BUSINESS_TYPES = {
    '1':'Sole Proprietorship','2':'HUF','3':'Private Limited','4':'Public Limited',
    '5':'LLP','6':'Government','7':'Trust','8':'AOP','9':'Local Authority'
  };

  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) return null;
  return {
    state_code: gstin.substring(0, 2),
    state: STATE_CODES[gstin.substring(0, 2)] || 'Unknown',
    pan: gstin.substring(2, 12),
    entity_type: BUSINESS_TYPES[gstin.charAt(12)] || 'Unknown'
  };
}

export function formatCurrency(num) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(num || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return dateStr;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
