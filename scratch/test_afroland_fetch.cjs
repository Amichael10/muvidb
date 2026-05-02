

(async () => {
    try {
        const res = await fetch('https://api-ott.afrolandtv.com/getreferencedobjects?&banners=0&categories=3%2C92&connection=wifi&device_type=desktop&for_user=0&image_format=widescreen&image_width=366&is_af_request=1&language=en&object_type=video&order=random&parent_id=895&parent_type=collection&partner=internal&platform=web&timestamp=1777693430&timezone=0100&use_device_width_widescreen=1&version=13&video_type=non_episode');
        const json = await res.json();
        console.log(JSON.stringify(json, null, 2));
    } catch (e) {
        console.error(e);
    }
})();
