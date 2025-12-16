// Proxy Service for Country-Based Bright Data Proxies
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const geoip = require('geoip-lite');

// Bright Data Proxy Configuration
const PROXY_CONFIG = {
  host: process.env.PROXY_HOST || 'brd.superproxy.io',
  port: process.env.PROXY_PORT || 33335,
  username: process.env.PROXY_USERNAME || 'brd-customer-hl_acbb125b-zone-residential_proxy1',
  password: process.env.PROXY_PASSWORD || '0r3m01o2pbhp',
  allowedCountries: process.env.PROXY_ALLOWED_COUNTRIES ? process.env.PROXY_ALLOWED_COUNTRIES.split(',').map(c => c.trim().toLowerCase()) : ['in', 'pk'],
  defaultCountry: process.env.PROXY_DEFAULT_COUNTRY || 'in',
  enabled: process.env.PROXY_ENABLED !== 'false' // Enable by default, set PROXY_ENABLED=false to disable
};

// Log proxy configuration status on startup (without sensitive data)
console.log('🔧 Proxy Configuration:');
console.log(`   Enabled: ${PROXY_CONFIG.enabled}`);
console.log(`   Host: ${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`);
console.log(`   Username: ${PROXY_CONFIG.username} (country will be appended)`);
console.log(`   Default Country: ${PROXY_CONFIG.defaultCountry.toUpperCase()}`);
console.log(`   Allowed Countries: ${PROXY_CONFIG.allowedCountries.map(c => c.toUpperCase()).join(', ')}`);

/**
 * Detect user's country from IP address
 * @param {string} ip - User's IP address
 * @returns {string} - Two-letter country code (lowercase)
 */
export function detectCountryFromIP(ip) {
  try {
    // Handle localhost/development
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
      console.log(`⚠️  Localhost detected, using default country: ${PROXY_CONFIG.defaultCountry.toUpperCase()}`);
      return PROXY_CONFIG.defaultCountry;
    }

    // Remove IPv6 prefix if present (::ffff:192.168.1.1 -> 192.168.1.1)
    const cleanIP = ip.replace(/^::ffff:/, '');

    // Lookup country using geoip-lite
    const geo = geoip.lookup(cleanIP);
    
    if (geo && geo.country) {
      const countryCode = geo.country.toLowerCase();
      console.log(`✅ Country detected from IP ${cleanIP}: ${countryCode.toUpperCase()}`);
      
      // Check if country is in allowed list
      if (PROXY_CONFIG.allowedCountries.includes(countryCode)) {
        console.log(`✅ Country ${countryCode.toUpperCase()} is supported for proxy routing`);
        return countryCode;
      } else {
        console.log(`⚠️  Country ${countryCode.toUpperCase()} not in allowed list, using default: ${PROXY_CONFIG.defaultCountry.toUpperCase()}`);
        return PROXY_CONFIG.defaultCountry;
      }
    } else {
      console.log(`⚠️  Could not detect country from IP ${cleanIP}, using default: ${PROXY_CONFIG.defaultCountry.toUpperCase()}`);
      return PROXY_CONFIG.defaultCountry;
    }
  } catch (error) {
    console.error(`❌ Error detecting country from IP: ${error.message}`);
    console.log(`⚠️  Using default country: ${PROXY_CONFIG.defaultCountry.toUpperCase()}`);
    return PROXY_CONFIG.defaultCountry;
  }
}

/**
 * Build Bright Data proxy URL with country-specific routing
 * @param {string} countryCode - Two-letter country code (lowercase)
 * @returns {string|null} - Proxy URL in format: http://username:password@host:port, or null if disabled
 */
export function buildProxyURL(countryCode) {
  // Check if proxy is enabled
  if (!PROXY_CONFIG.enabled) {
    return null;
  }

  // Validate country code
  const country = countryCode ? countryCode.toLowerCase() : PROXY_CONFIG.defaultCountry;
  
  // Build username with country code (Bright Data format)
  const usernameWithCountry = `${PROXY_CONFIG.username}-country-${country}`;
  
  // Build proxy URL (no encoding needed for standard credentials)
  // Format: http://username:password@host:port
  const proxyURL = `http://${usernameWithCountry}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
  
  return proxyURL;
}

/**
 * Get proxy details for logging
 * @param {string} countryCode - Two-letter country code (lowercase)
 * @returns {object} - Proxy configuration details
 */
export function getProxyDetails(countryCode) {
  const country = countryCode ? countryCode.toLowerCase() : PROXY_CONFIG.defaultCountry;
  const usernameWithCountry = `${PROXY_CONFIG.username}-country-${country}`;
  const proxyURL = buildProxyURL(country);
  
  return {
    host: PROXY_CONFIG.host,
    port: PROXY_CONFIG.port,
    username: usernameWithCountry,
    country: country.toUpperCase(),
    enabled: PROXY_CONFIG.enabled,
    fullURL: proxyURL
  };
}

/**
 * Extract user IP from Express request
 * Handles x-forwarded-for, x-real-ip, and direct connection
 * @param {object} req - Express request object
 * @returns {string} - User's IP address
 */
export function getUserIP(req) {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, first one is the client
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Try x-real-ip header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Fall back to direct connection IP
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Log proxy usage details
 * @param {object} proxyDetails - Proxy configuration details
 * @param {string} videoUrl - YouTube video URL
 */
export function logProxyUsage(proxyDetails, videoUrl) {
  console.log('='.repeat(80));
  console.log('🌐 PROXY ROUTING DETAILS:');
  console.log('='.repeat(80));
  console.log('🏳️  Country:', proxyDetails.country);
  console.log('🖥️  Proxy Host:', proxyDetails.host);
  console.log('🔌 Proxy Port:', proxyDetails.port);
  console.log('👤 Proxy Username:', proxyDetails.username);
  console.log('🎥 Video URL:', videoUrl);
  console.log('='.repeat(80));
}
