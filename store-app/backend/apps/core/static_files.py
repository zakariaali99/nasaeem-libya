"""WhiteNoise serves every file under WHITENOISE_ROOT (the built SPA). That
directory also holds `.htaccess` (Passenger paths) and OS junk such as
`.DS_Store`, which must never be downloadable, and a stale `media/` copy that
would shadow the real uploads served by Django. Both are skipped when the file
map is built (production) and on lookup (autorefresh/DEBUG)."""
from whitenoise.middleware import WhiteNoiseMiddleware


def _is_excluded(url: str) -> bool:
    parts = [part for part in url.split("/") if part]
    return bool(parts) and (parts[0] == "media" or any(part.startswith(".") for part in parts))


class SafeWhiteNoiseMiddleware(WhiteNoiseMiddleware):
    def add_file_to_dictionary(self, url, path, stat_cache=None):
        if _is_excluded(url):
            return
        super().add_file_to_dictionary(url, path, stat_cache=stat_cache)

    def find_file(self, url):
        if _is_excluded(url):
            return None
        return super().find_file(url)
