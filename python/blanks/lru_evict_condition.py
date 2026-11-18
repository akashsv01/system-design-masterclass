def put(cache, key, value):
    if key in cache.items:
        cache.items.move_to_end(key)
    elif ____:
        cache.items.popitem(last=False)
    cache.items[key] = value
