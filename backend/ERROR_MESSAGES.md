# Error Messages Documentation

| Technical Error Pattern | User-Friendly Message |
|------------------------|----------------------|
| `invalid youtube url` or `invalid url` | Please enter a valid YouTube video URL |
| `private` or `sign in to confirm` | This video is private or requires sign-in. Please use a public video. |
| `unavailable` or `removed` or `deleted` | This video is unavailable or has been removed. Please try a different video. |
| `age-restricted` | This video is age-restricted and cannot be processed. Please try a different video. |
| `rate limit` or `429` | Too many requests. Please wait a moment and try again. |
| `could not download` or `download failed` | Unable to download video. The video might be unavailable or restricted. |
| `openai` or `whisper` + `connection` or `econnrefused` or `timeout` | Unable to connect to transcription service. Please check your internet connection and try again. |
| `openai` or `whisper` + `401` or `unauthorized` or `api key` | Transcription service authentication failed. Please contact support. |
| `openai` or `whisper` + `429` or `rate limit` | Transcription service is busy. Please try again in a few moments. |
| `openai` or `whisper` + `too large` or `25mb` | This video is too long to process. Please try a shorter video (under 25 minutes). |
| `openai` or `whisper` + `empty text` or `no transcript` | No transcript could be generated from this video. The video might not have audio or captions. |
| `groq` or `translation` or `llama` + `connection` or `timeout` | Unable to connect to translation service. Please check your internet connection and try again. |
| `groq` or `translation` or `llama` + `429` or `rate limit` or `rate_limit_exceeded` or `Rate limit reached` | Translation service rate limit reached. Please try again in [retry time] or about an hour. |
| `tokens per day` or `TPD` or `tokens` (in translation context) | Translation service quota exceeded. Please try again later or contact support. |
| `groq` or `translation` or `llama` + `401` or `unauthorized` or `api key` | Translation service authentication failed. Please contact support. |
| `groq` or `translation` or `llama` + `token` or `max_tokens` | This video transcript is too long to translate. Please try a shorter video. |
| `network` or `econnrefused` or `enotfound` | Network connection error. Please check your internet connection and try again. |
| `timeout` or `etimedout` | Request timed out. The video might be too long or the service is slow. Please try again. |
| `stripe` or `payment` + `card` or `declined` | Your payment was declined. Please check your card details and try again. |
| `stripe` or `payment` + `insufficient` | Insufficient funds. Please use a different payment method. |
| `stripe` or `payment` (general) | Payment processing error. Please check your payment details and try again. |
| Any other unexpected error | An unexpected error occurred. Please try again or contact support if the problem persists. |

