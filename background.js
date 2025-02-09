// BUG FIX: The tracker stops running when the user moves to a tab that should be tracked from a different browser window. 

// Initialize predefined URLs with time limits (in milliseconds)
const predefinedUrls = {
    "www.reddit.com": 30 * 60 * 1000, // 30 minute
    "www.youtube.com": 30 * 60 * 1000, // 30 minutes
    "www.chess.com": 45 * 60 * 1000 // 45 minutes
};

const predefinedallowlist = {
    "https://www.reddit.com/r/australia/comments/1i9iwgf/best_mayo/": "Reddit Mayo post"
};

const frequency = 5000; // the tracking frequency is 5 second

var activeDomain = null;
var activeTabId = null;
var activeWindowId = null; // This creates an issue, as the tracker stops running when the window is not focused, even while the user is using the browser unfocused mode. However, if I remove this, the tracker will run when the window is not focused. So, the idle time will be tracked.


// Initialize storage for tracking time
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({ webSiteInformation: {} }, () => {
        console.log("Initialized webSiteInformation storage.");
    });
    chrome.storage.sync.set({ websiteAllowList: {} }, () => {
        console.log("Initialized websiteAllowList storage.");
    });

    // Add all the predefined URLs to the webSiteInformation storage
    chrome.storage.sync.get(['webSiteInformation'], (result) => {
        const webSiteInformation = result.webSiteInformation || {};

        for (const domain in predefinedUrls) {
            webSiteInformation[domain] = { timeSpent: 0, resets: 0, timeLimit: predefinedUrls[domain], date: new Date().toDateString(), whoIsTracking: 0 };
        }

        chrome.storage.sync.set({ webSiteInformation }, () => {
            console.log("Added predefined URLs to webSiteInformation storage.");
        });
    });

    // Add all the URLs in the predefinedallowlist to the websiteAllowList storage
    chrome.storage.sync.get(['websiteAllowList'], (result) => {
        const websiteAllowList = result.websiteAllowList || {};

        for (const url in predefinedallowlist) {
            websiteAllowList[url] = predefinedallowlist[url];
        }

        chrome.storage.sync.set({ websiteAllowList }, () => {
            console.log("Added URLs in the allowlist to websiteAllowList storage.");
        });
    });
});

// The key is either webSiteInformation or websiteAllowList
function getStorageData(key) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get([key], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result[key] || {});
            }
        });
    });
}

function updatewebSiteInformation(domain, timeSpent, resets, timeLimit, date, whoIsTracking) {
    chrome.storage.sync.get(['webSiteInformation'], (result) => {
        const webSiteInformation = result.webSiteInformation;
        webSiteInformation[domain].timeSpent = timeSpent;
        webSiteInformation[domain].resets = resets;
        webSiteInformation[domain].timeLimit = timeLimit;
        webSiteInformation[domain].date = date;
        webSiteInformation[domain].whoIsTracking = whoIsTracking;
        chrome.storage.sync.set({ webSiteInformation });
    });
}

// Run isTodayNewDay when the browser becomes active
chrome.idle.onStateChanged.addListener(async (state) => {
    if (state === 'active') {
        const webSiteInformation = getStorageData('webSiteInformation');
        for (const domain in webSiteInformation) {
            await isTodayNewDay(domain);
        }
    }
});

// Run isTodayNewDay at 00:00 everyday (if the browser is open)
function getNextMidnight() {
    const now = new Date();
    now.setHours(24, 0, 0, 0);
    return now.getTime();
}

chrome.alarms.create('newDay', { when: getNextMidnight(), periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'newDay') {
        const webSiteInformation = await getStorageData('webSiteInformation');
        for (const domain in webSiteInformation) {
            await isTodayNewDay(domain);
        }
    }
});

// On startup, check if the day is new
chrome.runtime.onStartup.addListener(async () => {
    const webSiteInformation = await getStorageData('webSiteInformation');
    for (const domain in webSiteInformation) {
        await isTodayNewDay(domain);
    }
});

// If the day is new, reset the time spent, resets and whoistracking values.
async function isTodayNewDay(domain) {
    const webSiteInformation = await getStorageData('webSiteInformation');
    const today = new Date().toDateString();
    if (webSiteInformation[domain].date !== today) {
        // This leads to a race condition. If other threads are tracking a given domain this may not work, as they will overide the values. This can be fixed by adding day checking to the tracking function.
        updatewebSiteInformation(domain, 0, 0, webSiteInformation[domain].timeLimit, today, 0);
    }
}

// Get the active window ID upon window creation
chrome.windows.onCreated.addListener((window) => {
    activeWindowId = window.id;
});

// Get the active window ID upon window focus update
chrome.windows.onFocusChanged.addListener((window) => {
    activeWindowId = window.id;
});

// Get the active tab ID, Window ID and URL upon tab activation and track time spent
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    activeTabId = activeInfo.tabId;
    activeWindowId = activeInfo.windowId;
    const tab = await getTab(activeTabId);
    if (tab.url) {
        try {
            activeDomain = new URL(tab.url).hostname;
            const isIn = await shouldTrack(tab.url);
            if (isIn) {
                await trackTimeSpent(activeTabId, tab.url, activeWindowId, frequency);
            }
        } catch (e) {
            console.error(`Invalid URL: ${tab.url}`, e);
        }
    }
});

// Get tab information by tab ID
function getTab(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(tab);
            }
        });
    });
}

// Get the updated tab ID, window ID and URL upon tab update and track time spent
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            activeDomain = new URL(tab.url).hostname;
            activeTabId = tabId;
            activeWindowId = tab.windowId;
            const isIn = await shouldTrack(tab.url);
            if (isIn) {
                await trackTimeSpent(activeTabId, tab.url, activeWindowId, frequency);
            }
        } catch (e) {
            console.error(`Invalid URL: ${tab.url}`, e);
        }
    }
});

// Check whether the URL and Domain are in the given lists.
async function shouldTrack(url) {
    const domain = new URL(url).hostname;

    const webSiteInformation = await getStorageData('webSiteInformation');
    if (!webSiteInformation.hasOwnProperty(domain)) {
        // console.log(`Domain: ${domain} is not in the webSiteInformation storage.`);
        return false;
    }

    const websiteAllowList = await getStorageData('websiteAllowList');
    if (websiteAllowList.hasOwnProperty(url)) {
        // console.log(`URL is in the allow list: ${url}`);
        return false;
    }

    return true;
}

// Track time spent on websites
async function trackTimeSpent(tabId, url, windowId, frequency) {
    var thisRunsTrackingNumber = 0;
    const domain = new URL(url).hostname;
    if (activeTabId !== undefined && activeDomain !== undefined && activeWindowId !== undefined) {
        // console.log("Tracking function called.");

        // Get the whoistracking value of the domain and give a new value. This is to stop the interval if another thread is tracking the same domain.
        const webSiteInformation = await getStorageData('webSiteInformation');
        thisRunsTrackingNumber = webSiteInformation[domain].whoIsTracking + 1;
        updatewebSiteInformation(domain, webSiteInformation[domain].timeSpent, webSiteInformation[domain].resets, webSiteInformation[domain].timeLimit, webSiteInformation[domain].date, thisRunsTrackingNumber);

        var interval = setInterval(async function () {
            if (activeTabId != tabId || activeWindowId != windowId || activeDomain != domain) {
                clearInterval(interval);
            } else {
                const webSiteInformationNew = await getStorageData('webSiteInformation');
                const currentTracker = webSiteInformationNew[domain].whoIsTracking;
                const limitPassed = await checkTimeLimitPassed(domain, webSiteInformationNew[domain].timeSpent, webSiteInformationNew[domain].timeLimit);
                const isIn = await shouldTrack(url);
                if (!limitPassed && currentTracker === thisRunsTrackingNumber && isIn) {
                    // console.log(`Domain: ${domain} is tracking now.`);
                    const newTimeSpent = webSiteInformationNew[domain].timeSpent + frequency;
                    updatewebSiteInformation(domain, newTimeSpent, webSiteInformationNew[domain].resets, webSiteInformationNew[domain].timeLimit, webSiteInformationNew[domain].date, webSiteInformationNew[domain].whoIsTracking);
                } else {
                    clearInterval(interval);
                }
            }
        }, frequency);
    } else {
        console.error('activeTabId, activeDomain, or activeWindowId is undefined.');
    }
}

// Check if the time limit is exceeded
async function checkTimeLimitPassed(domain, timeSpent, timeLimit) {
    if (timeSpent > timeLimit) {
        // console.log(`Time limit exceeded for ${domain}: ${timeSpent} ms`);
        blockWebsite(domain);
        return true;
    }
    else {
        return false;
    }
}

// Block access to the website
async function blockWebsite(domain) {
    try {
        const tabs = await queryTabs(`*://${domain}/*`);
        for (const tab of tabs) {
            const url = tab.url;
            const isIn = await shouldTrack(url);
            if (isIn) {
                await removeTab(tab.id);
            }
            //  console.log(`Blocked access to ${domain} by closing tab ${tab.id}`);
        }
    } catch (error) {
        console.error(`Failed to block website ${domain}:`, error);
    }
}

// Helper function to query tabs
function queryTabs(url) {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ url }, (tabs) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(tabs);
            }
        });
    });
}

// Helper function to remove a tab
function removeTab(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}