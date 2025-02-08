document.addEventListener('DOMContentLoaded', () => {
    const websiteList = document.getElementById('websiteList');
    const settingsButton = document.getElementById('settingsButton');

    // Fetch website times from storage and display them
    chrome.storage.sync.get(['webSiteInformation'], (result) => {
        const webSiteInformation = result.webSiteInformation || {};
        for (const [domain, data] of Object.entries(webSiteInformation)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${domain}</td>
                <td>${(Math.round(data.timeSpent / 1000) / 60).toFixed(2)} minutes</td>
                <td>${(data.timeLimit / 1000 / 60).toFixed(2)} minutes</td>
                <td>${data.resets}</td>
            `;
            websiteList.appendChild(row);
        }
    });

    settingsButton.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });
});