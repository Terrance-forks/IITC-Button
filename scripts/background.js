let activeIITCTab = null;
let updateChannel = 'release';
const {
  onActivated,
  onUpdated,
  onRemoved
} = chrome.tabs;
// tab
onActivated.addListener(onActivatedListener);
onUpdated.addListener(onUpdatedListener);
onRemoved.addListener(onRemovedListener);

chrome.runtime.onMessage.addListener(function(request) {
  switch (request.type) {
    case "requestOpenIntel":
      onRequestOpenIntel(request.tab);
      break;
    case "toggleIITC":
      onToggleIITC(request.value);
      break;
  }
});

async function onRequestOpenIntel(id) {
  if (!id) return;
  const {
    active,
    url
  } = await getTabInfo(id);
  if (activeIITCTab) {
    let isActive = false;

    try {
      isActive = await getTabInfo(activeIITCTab);
    } catch (e) {
      console.warn('tab not found:', activeIITCTab);
    }

    if (!!isActive) {
      console.log('found activeIITCTab %s', activeIITCTab);
      return setTabActive(activeIITCTab);
    } else {
      activeIITCTab = null;
    }
  }
  if (active) {
    if (isIngressUrl(url)) {
      console.log('detected ingress.com/intel page on active tab %d', id);
      return;
    }

    return chrome.tabs.create({
      url: 'https://intel.ingress.com/intel',
      pinned: true
    }, function(tab) {
      activeIITCTab = tab.id;
    });
  }
}

async function onToggleIITC(value) {
  chrome.storage.local.set({'IITC_is_enabled': value}, async function() {
    console.log('Value is set to ' + value);
    if (activeIITCTab) {
      let isActive = false;

      try {
        isActive = await getTabInfo(activeIITCTab);
      } catch (e) {
        console.warn('tab not found:', activeIITCTab);
      }

      if (!!isActive) {
        console.log('found activeIITCTab %s', activeIITCTab);
        return chrome.tabs.reload(activeIITCTab);
      } else {
        activeIITCTab = null;
      }
    }
  });

}


// tab listeners
async function onUpdatedListener(tabId, status) {
  if (status.status) {
    console.log(JSON.stringify(status));
    console.log(status.status, ':tab updated #', tabId);

    const {
      active,
      url
    } = await getTabInfo(tabId);
    if (tabId === activeIITCTab) {
      console.log('remove activeIITCTab');
      if(status.status === 'loading' && status.url) {
        console.info('navigate to %s', status.url);
      }
    }
    console.log('tab is active: ', active);
    if (active) {
      //chrome.pageAction.show(tabId);
    } else return false;

    if (status.status === 'complete') {
      if (isIngressUrl(url)) {
        console.log('detected intel.ingress.com/intel page on active tab %d', tabId);
        console.log('requested iitc launch');
        console.log('initializing iitc');
        initialize(tabId);
      }
    }

    return false;
  }
}

function onRemovedListener(tabId) {
  console.log(tabId + ': closing');
  if (activeIITCTab === tabId) {
    activeIITCTab = null;
    console.log('removed iitc flags')
  }
}

async function onActivatedListener({
  tabId,
  url
}) {
  if (!tabId) {
    throw new Error('not tabId found')
  }
  console.log('tab activated #', tabId);
  const tabInfo = await getTabInfo(tabId);
  if (tabInfo) {
    const isIngressTab = isIngressUrl(tabInfo.url)

    if (isIngressTab) {
      console.log('tab has Intel url #', tabId);
    }
  }

  const {
    active
  } = await getTabInfo(tabId);
  //if (active) chrome.pageAction.show(tabId);
}

function initialize(tabId) {

  chrome.storage.local.get([
    "IITC_is_enabled",
    "update_channel",
    "release_iitc_code",
    "test_iitc_code",
    "release_plugins_local",
    "test_plugins_local",
    "release_plugins_user",
    "test_plugins_user"
  ], function(data){

    if (data.update_channel) {
      updateChannel = data.update_channel;
    }
    console.log('update channel (background): '+updateChannel);

    let status = data['IITC_is_enabled'];
    let iitc_code = data[updateChannel+'_iitc_code'];
    if ((status === undefined || status === true) && iitc_code !== undefined) {

      let plugins_local = data[updateChannel+'_plugins_local'];
      if (plugins_local !== undefined) {
        Object.keys(plugins_local).forEach(function(id) {
          let plugin = plugins_local[id];
          if (plugin['status'] === 'on') {
            loadJS(tabId, "document_idle", plugin['code'], function () {
              console.info('plugin %s loaded', id);
            });
          }
        });
      }

      let plugins_user = data[updateChannel+'_plugins_user'];
      if (plugins_user !== undefined) {
        Object.keys(plugins_user).forEach(function(id) {
          let plugin = plugins_user[id];
          if (plugin['status'] === 'on') {
            loadJS(tabId, "document_idle", plugin['code'], function () {
              console.info('userscript %s loaded', id);
            });
          }
        });
      }

      chrome.tabs.executeScript(tabId, {
        runAt: "document_idle",
        file: './scripts/pre.js'
      }, () => {
        loadJS(tabId, "document_idle", iitc_code, function () {
          activeIITCTab = tabId;
        });
      });

    }
  });

}


function loadJS(tabId, runAt, code, callback) {
  if(!tabId) { console.log('no tabId!'); return}
  callback = (typeof callback == 'function' ? callback : false);

  chrome.tabs.executeScript(tabId, {
    runAt: runAt,
    code: code+";true"
  }, () => {
    if(chrome.runtime.lastError) {
      console.log('err');
      console.log(chrome.runtime.lastError.message);
    }
    if (callback) callback();
  });

}

function setTabActive(tabId) {
  chrome.tabs.update(tabId, {
    active: true
  }, async (tab) => {
    try {
      setWindowFocused(tab.windowId)
    } catch (e) {
      console.log(e);
      activeIITCTab = null;
      console.log('repeated click with updated params');
      let id = await getActiveTab();
      onRequestOpenIntel(id);
    }
  });
}

function setWindowFocused(windowId) {
  chrome.windows.update(windowId, { focused: true });
}

function getTabInfo(tabId) {
  return new Promise(resolve => chrome.tabs.get(tabId, resolve));
}

async function getActiveTab() {
  return new Promise(resolve => chrome.tabs.query({ active: true }, resolve))
    .then(function(current) {
      if (current && current[0]) {
      return current[0].id
      } else {
        throw new Error('current tab not found')
      }
  });
}

/* function togglePageAction(state, id) {
  state = state ? 'show' : 'hide';

  chrome.pageAction.setIcon({ tabId: id, path: state ? "assets/images/48/logo.png" : "assets/images/19/logo-ok.png" });
  chrome.pageAction.setTitle({ tabId: id, title: state ? "open IITC" : "Intel Ingress Enable is Activated" });
  chrome.pageAction[state](id);
} */
function isIngressUrl(url) {
  if (url) {
    return (/intel.ingress.com\/intel/.test(url))
  }
  return false
}
