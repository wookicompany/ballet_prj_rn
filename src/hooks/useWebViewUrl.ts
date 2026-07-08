import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';
import { DEFAULT_WEBVIEW_URL } from '../constants/config';
import { getWebViewUrlFromDeepLink } from '../navigation/linking';

export function useWebViewUrl() {
  const [url, setUrl] = useState(() => DEFAULT_WEBVIEW_URL);

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const webUrl = getWebViewUrlFromDeepLink(event.url);
      if (webUrl) setUrl(webUrl);
    };

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) {
        const webUrl = getWebViewUrlFromDeepLink(initialUrl);
        if (webUrl) setUrl(webUrl);
      }
    });

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  return { url, setUrl };
}
