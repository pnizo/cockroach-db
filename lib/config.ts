/**
 * Environment Configuration
 * Centralizes environment variable access and validation
 */

export type Environment = 'development' | 'staging' | 'production';

export interface AppConfig {
  env: Environment;
  nodeEnv: string;
  isDevelopment: boolean;
  isStaging: boolean;
  isProduction: boolean;
  database: {
    url: string;
  };
  app: {
    url: string;
  };
  auth: {
    basicAuthUser?: string;
    basicAuthPassword?: string;
  };
  email: {
    gmailUser?: string;
    gmailAppPassword?: string;
  };
  calendar: {
    googleClientEmail?: string;
    googlePrivateKey?: string;
    googleCalendarId?: string;
  };
  cron: {
    secret?: string;
  };
}

/**
 * Get the current environment
 */
export function getEnvironment(): Environment {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';

  if (appEnv === 'staging') return 'staging';
  if (appEnv === 'production') return 'production';
  return 'development';
}

/**
 * Get the application configuration
 */
export function getConfig(): AppConfig {
  const env = getEnvironment();
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    env,
    nodeEnv,
    isDevelopment: env === 'development',
    isStaging: env === 'staging',
    isProduction: env === 'production',
    database: {
      url: process.env.DATABASE_URL || '',
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    auth: {
      basicAuthUser: process.env.BASIC_AUTH_USER,
      basicAuthPassword: process.env.BASIC_AUTH_PASSWORD,
    },
    email: {
      gmailUser: process.env.GMAIL_USER,
      gmailAppPassword: process.env.GMAIL_APP_PASSWORD,
    },
    calendar: {
      googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY,
      googleCalendarId: process.env.GOOGLE_CALENDAR_ID,
    },
    cron: {
      secret: process.env.CRON_SECRET,
    },
  };
}

/**
 * Validate required environment variables
 */
export function validateConfig(): void {
  const config = getConfig();
  const errors: string[] = [];

  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

/**
 * Log current environment (useful for debugging)
 */
export function logEnvironment(): void {
  const config = getConfig();
  console.log('=================================');
  console.log('Environment Configuration');
  console.log('=================================');
  console.log(`Environment: ${config.env}`);
  console.log(`Node Environment: ${config.nodeEnv}`);
  console.log(`App URL: ${config.app.url}`);
  console.log(`Database: ${config.database.url ? 'Configured' : 'Not configured'}`);
  console.log('=================================');
}

// Export singleton config instance
export const config = getConfig();
