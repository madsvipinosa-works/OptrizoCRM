(async () => {
    try {
        console.log('Fetching localhost:3000...');
        const res = await fetch('http://localhost:3000');
        console.log('Status:', res.status);
        const text = await res.text();
        console.log('HTML Length:', text.length);
        if (text.includes('Client-side exception has occurred')) {
            console.log('Found next.js client exception in HTML!');
        }
    } catch (e) {
        console.log('Fetch error:', e.message);
    }
})();
