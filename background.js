/*
registerDownloadsEvents
registerWebRequestEvents
registerTabEvents
*/

let apiUrl = "";
let application = "com.trustedcopy.secure";
let headerStore = {};
var ffname = [];
let activeTabId = null;
let pendingDownloads = [];

let captureDownload = function (_file) {
  // sending message to tab
  chrome.tabs.query(
    { active: true, currentWindow: true },
    async function (tabs) {
      var activeTab = tabs[0];
      let capturedRequest = null;
      let tabHeaderStore = headerStore[activeTab.id];
      if (tabHeaderStore && tabHeaderStore.request.length > 0) {
        tcLogger("[tabs] [query]", "Active Tab", activeTab.id);
        capturedRequest = tabHeaderStore.request.find(
          (req) => req.url == _file.url
        );
        // if request not found, then get the last request and take the headers from it
        if (!capturedRequest) {
          tcLogger(
            "[tabs] [query]",
            "{captureDownload} request was not found so looking for most recent request",
            activeTab.id
          );
          capturedRequest =
            tabHeaderStore.request[tabHeaderStore.request.length - 1];
          if (capturedRequest) {
            capturedRequest.url = _file.url;
          }
        }
      }
      tcLogger(
        "[OnCreate] [CapturedRequest]",
        "Download ",
        headerStore[activeTab.id]
      );

      // let port = chrome.runtime.connectNative(`${application}`);
      // port.postMessage({ payload: JSON.stringify(request) });
      let user = await chrome.storage.local.get(["user"]);
      tcLogger(
        "[OnCreate] [CapturedRequest]",
        `SENDING NATIVE MESSAGE to ${application}`,
        {
          capturedRequest,
          user,
        }
      );

      if (user) {
        console.log("BEFORE ", user.user);
        let userObject = JSON.parse(user.user);
        console.log("AFTER ", userObject);
        chrome.runtime.sendNativeMessage(
          `${application}`,
          { data: capturedRequest, user: userObject, filename: _file.filename },
          function (response) {
            tcLogger(
              "[runtime] [sendNativeMessage]",
              `RESPONSE FROM ${application} `,
              response
            );
          }
        );
      }

      // chrome.tabs.sendMessage(activeTab.id, {
      //   message: "Received a document for upload",
      //   download: down,
      //   capturedRequest: capturedRequest,
      // });
    }
  );
};

let registerDownloadsEvents = function () {
  // Listen for download events
  tcLogger("[downloads] [onCreated]", "REGISTER");
  chrome.downloads.onCreated.addListener(function (down) {
    tcLogger("[downloads] [onCreated]", "Download ", down);
  });

  tcLogger("[downloads] [onChanged]", "REGISTER");
  chrome.downloads.onChanged.addListener(function (_change) {
    tcLogger("[downloads] [onChanged]", "CALLBACK ", _change);
    if (_change.state && _change.state.current === "complete") {
      tcLogger(
        "[downloads] [onChanged]",
        "CALLBACK DOWNLOAD COMPLETED  ",
        _change
      );
    }
  });

  tcLogger("[downloads] [onDeterminingFilename]", "REGISTER");
  chrome.downloads.onDeterminingFilename.addListener(async function (
    item,
    suggest
  ) {
    tcLogger("[downloads] [onDeterminingFilename]", "CALLBACK ", item);

    if (item.finalUrl.startsWith("blob")) {
      // for now; ignoring all blob downloads
      return;
    }

    if (pendingDownloads.indexOf(item.url) > -1) {
      tcLogger("[downloads] [cancel]", "--- APPROVED REQUEST --- ", item);
      pendingDownloads = pendingDownloads.filter((dbb) => dbb != item.url);
      // halt
      return;
    } else {
      tcLogger("[downloads] [cancel]", "CANCELLING DOWNLOAD ", item);
      chrome.downloads.cancel(item.id, function (_cancel) {
        tcLogger("[downloads] [cancel]", "Result ", _cancel);
      });
    }

    // const [tab] = await chrome.tabs.query({
    //   active: true,
    //   lastFocusedWindow: true,
    // });
    let message = {
      source: "TC#BG",
      action: "DOWNLOAD_APPROVAL",
      tabId: activeTabId,
      download: item,
      message: `Do you want to save the ${item.filename} to vault ?`,
    };
    tcLogger(
      "[tabs] [sendMessage]",
      `SENDING MESSAGE TO TAB ${activeTabId}`,
      message
    );

    await chrome.tabs.sendMessage(activeTabId, message);
    tcLogger("[tabs] [sendMessage]", `RESPONSE FROM TAB ${activeTabId}`);
  });
};

let registerWebRequestEvents = function () {
  tcLogger("[webRequest] [onSendHeaders]", "REGISTER ");
  chrome.webRequest.onSendHeaders.addListener(
    function (info) {
      tcLogger("[webRequest] [onSendHeaders]", "CALLBACK ", info);
      if (parseInt(info.tabId, 10) > 0) {
        activeTabId = info.tabId;
        if (typeof headerStore[info.tabId] === "undefined") {
          headerStore[info.tabId] = {};
          headerStore[info.tabId].request = [];
          headerStore[info.tabId].response = [];
        }

        if (info.url.indexOf("blob") > -1) {
          tcLogger("[webRequest] [onSendHeaders]", "CALLBACK **BLOB** ", info);
        }

        headerStore[info.tabId].request.push(info);
      }
    },
    {
      urls: ["http://*/*", "https://*/*"],
      types: ["main_frame", "other", "sub_frame"],
      //types: ['main_frame','sub_frame','stylesheet','script','image','object','xmlhttprequest','other']
    },
    ["requestHeaders", "extraHeaders"]
  );
};

let registerTabEvents = function () {
  /**
   * Cleanup headerStore when tab closes
   */
  tcLogger("[tabs] [onRemoved]", "REGISTER");
  chrome.tabs.onRemoved.addListener(function (tabId) {
    delete headerStore[tabId];
  });
};

let tcLogger = function (_tag, _msg, _params, _error) {
  if (_error) {
    if (_params) {
      console.error(_tag, _msg, _params);
      return;
    }
    console.error(_tag, _msg);
    return;
  }
  if (_params) {
    console.log(_tag, _msg, _params);
    return;
  }
  console.log(_tag, _msg);
};

chrome.runtime.onMessage.addListener(async function (
  request,
  sender,
  sendResponse
) {
  tcLogger("[runtime] [onMessage]", `RECEIVED MESSAGE ${activeTabId}`, {
    request,
    sender,
    sendResponse,
  });

  if (request.source == "TC#CS" && request.action == "USER_INFO") {
    // saving user login info
    if (request.user) {
      await chrome.storage.local.set({ user: request.user });
    }
  } else if (
    request.source == "TC#CS" &&
    request.action == "DOWNLOAD_APPROVAL"
  ) {
    // starting the download process

    let download = request.download;

    if (sender.tab) {
      // that's from tab
      if (!request.saveToVault) {
        tcLogger("[runtime] [onMessage]", `DOWNLOADING VIA CHROME `, {
          request,
          sender,
          sendResponse,
        });

        pendingDownloads.push(download.url);

        chrome.downloads.download({
          url: download.url,
          filename: download.filename,
        });
      } else {
        tcLogger("[runtime] [onMessage]", `DOWNLOADING VIA ${application} `, {
          request,
          sender,
          sendResponse,
        });

        captureDownload(download);
      }
    }
  }
});

//
registerTabEvents();
registerWebRequestEvents();
registerDownloadsEvents();
