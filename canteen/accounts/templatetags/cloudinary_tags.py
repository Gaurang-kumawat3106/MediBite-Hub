from django import template

register = template.Library()

@register.filter(name='cloudinary_optimize')
def cloudinary_optimize(url, width=None):
    """
    Applies Cloudinary transformations (q_auto, f_auto, optional width limit)
    to existing Cloudinary image URLs dynamically on-the-fly.
    Leaves original Cloudinary images in storage untouched.
    """
    if not url or not isinstance(url, str):
        return url
    
    if "res.cloudinary.com" in url and "/upload/" in url:
        clean_url = url.replace("/q_auto:good", "/q_auto")
        if "/q_auto" not in clean_url and "/f_auto" not in clean_url:
            transform = f"q_auto,f_auto,w_{width},c_limit" if width else "q_auto,f_auto"
            return clean_url.replace("/upload/", f"/upload/{transform}/")
        return clean_url
    return url
