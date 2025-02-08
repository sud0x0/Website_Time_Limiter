document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        });
    });

    const websiteList = document.getElementById('websiteList');
    const addWebsiteForm = document.getElementById('addWebsiteForm');
    const allowList = document.getElementById('allowWebsiteList');
    const allowListForm = document.getElementById('allowListForm');

    chrome.storage.sync.get(['webSiteInformation'], (result) => {
        const webSiteInformation = result.webSiteInformation || {};
        for (const [domain, data] of Object.entries(webSiteInformation)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${domain}</td>
                <td>${(Math.round(data.timeSpent / 1000) / 60).toFixed(2)} minutes</td>
                <td>${(data.timeLimit / 1000 / 60).toFixed(2)} minutes</td>
                <td><button data-domain="${domain}" class="resetButton">Reset</button></td>
                <td>${data.resets}</td>
                <td><button data-domain="${domain}" class="deleteButton">Delete</button></td>
                <td><button data-domain="${domain}" class="blockButton">Block</button></td>
            `;
            websiteList.appendChild(row);
        }

        // Add event listeners to reset buttons
        document.querySelectorAll('.resetButton').forEach(button => {
            button.addEventListener('click', (event) => {
                const domain = event.target.getAttribute('data-domain');
                chrome.storage.sync.get(['webSiteInformation'], (result) => {
                    const webSiteInformation = result.webSiteInformation || {};
                    if (webSiteInformation[domain]) {
                        webSiteInformation[domain].timeSpent = 0;
                        webSiteInformation[domain].resets = webSiteInformation[domain].resets + 1;
                        chrome.storage.sync.set({ webSiteInformation }, () => {
                            console.log(`Reset time for ${domain}`);
                            location.reload();
                        });
                    }
                });
            });
        });

        // Add event listeners to delete buttons
        document.querySelectorAll('.deleteButton').forEach(button => {
            button.addEventListener('click', (event) => {
                const domain = event.target.getAttribute('data-domain');
                chrome.storage.sync.get(['webSiteInformation'], (result) => {
                    const webSiteInformation = result.webSiteInformation || {};
                    delete webSiteInformation[domain];
                    chrome.storage.sync.set({ webSiteInformation }, () => {
                        console.log(`Deleted ${domain}`);
                        location.reload();
                    });
                });
            });
        });

        // Add event listeners to block buttons
        document.querySelectorAll('.blockButton').forEach(button => {
            button.addEventListener('click', (event) => {
                const domain = event.target.getAttribute('data-domain');
                chrome.storage.sync.get(['webSiteInformation'], (result) => {
                    const webSiteInformation = result.webSiteInformation || {};
                    if (webSiteInformation[domain]) {
                        webSiteInformation[domain].timeSpent = webSiteInformation[domain].timeLimit;
                        chrome.storage.sync.set({ webSiteInformation }, () => {
                            console.log(`Reset time for ${domain}`);
                            location.reload();
                        });
                    }
                });
            });
        });
    });

    chrome.storage.sync.get(['websiteAllowList'], (result) => {
        const websiteAllowList = result.websiteAllowList || {};
        for (const [url, data] of Object.entries(websiteAllowList)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${url}</td>
                <td>${data}</td>
                <td><button data-url="${url}" class="deleteAllowListButton">Delete</button></td>
            `;
            allowList.appendChild(row);
        }

        // Add event listeners to delete buttons
        document.querySelectorAll('.deleteAllowListButton').forEach(button => {
            button.addEventListener('click', (event) => {
                const url = event.target.getAttribute('data-url');
                chrome.storage.sync.get(['websiteAllowList'], (result) => {
                    const websiteAllowList = result.websiteAllowList || {};
                    delete websiteAllowList[url];
                    chrome.storage.sync.set({ websiteAllowList }, () => {
                        console.log(`Deleted ${url}`);
                        location.reload();
                    });
                });
            });
        });

    });

    // Add website form submission
    addWebsiteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const website = document.getElementById('website').value; // do input validation
        const timeLimit = document.getElementById('timeLimit').value; // do input validation

        chrome.storage.sync.get(['webSiteInformation'], (result) => {
            const webSiteInformation = result.webSiteInformation || {};
            webSiteInformation[website] = { timeSpent: 0, resets: 0, timeLimit: timeLimit * 60 * 1000, Date: new Date().toDateString(), whoIsTracking: 0 }
            chrome.storage.sync.set({ webSiteInformation }, () => {
                console.log(`Added ${website} with time limit ${timeLimit} minutes`);
                location.reload();
            });
        });
    });

    // Add allow list form submission
    allowListForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const url = document.getElementById('allowURL').value; // do input validation
        const description = document.getElementById('description').value; // do input validation

        chrome.storage.sync.get(['websiteAllowList'], (result) => {
            const websiteAllowList = result.websiteAllowList || {};
            websiteAllowList[url] = description
            chrome.storage.sync.set({ websiteAllowList }, () => {
                console.log(`Added ${url} to the allow list.`);
                location.reload();
            });
        });
    });
});