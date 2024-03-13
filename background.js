/*
<consts_variables>
*/

const HOST_API = "https://localhost:44351";
const HOST_DESKTOP_APP = "com.trustedcopy.secure";

const SCRIPTS = {
  BG_SCRIPT: "TC#BG",
  CONTENT_SCRIPT: "TC#CS",
  POPUP_SCRIPT: "TC#PP",
  APP_SCRIPT: "TC#APP",
};

const ACTIONS = {
  DOWNLOAD_APPROVAL: "DOWNLOAD_APPROVAL",
  DOWNLOAD_STATUS: "DOWNLOAD_STATUS",
  USER_INFO: "USER_INFO",
  NATIVE_HOST_CONNECT: "NATIVE_HOST_CONNECT",
};

let headerStore = {};
let activeTabId = null;
let pendingDownloads = [];
let port = null;
let isConnected = false;

/*
</consts_variables>
*/

let captureDownload = function (_selections, _file) {
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

      // let port = chrome.runtime.connectNative(`${HOST_DESKTOP_APP}`);
      // port.postMessage({ payload: JSON.stringify(request) });
      let user = await chrome.storage.local.get(["user"]);
      if (user) {
        let userObject = JSON.parse(user.user);
        let dataMessage = {
          data: capturedRequest,
          user: userObject,
          filename: _file.filename,
          selections: _selections,
        };

        chrome.runtime.sendNativeMessage(
          `${HOST_DESKTOP_APP}`,
          dataMessage,
          function (response) {
            if (chrome.runtime.lastError) {
              let message = {
                source: SCRIPTS.BG_SCRIPT,
                action: ACTIONS.NATIVE_HOST_CONNECT,
                target: SCRIPTS.CONTENT_SCRIPT,
                tabId: activeTabId,
                isConnected: false,
                message: chrome.runtime.lastError.message,
              };

              chrome.tabs.sendMessage(activeTab.id, message);
            } else {
              let message = {
                source: SCRIPTS.BG_SCRIPT,
                action: ACTIONS.NATIVE_HOST_CONNECT,
                target: SCRIPTS.CONTENT_SCRIPT,
                tabId: activeTabId,
                isConnected: true,
                result: response,
              };

              chrome.tabs.sendMessage(activeTab.id, message);
              tcLogger(
                "[runtime] [sendNativeMessage]",
                `RESPONSE FROM ${HOST_DESKTOP_APP} `,
                response
              );
            }
          }
        );

        // tcLogger(
        //   "[OnCreate] [CapturedRequest]",
        //   `SENDING NATIVE MESSAGE to ${HOST_DESKTOP_APP}`,
        //   dataMessage
        // );
        // if (!isConnected) {
        //   subscribeToNativeHost(dataMessage);
        // } else {
        //   try {
        //     port.postMessage(dataMessage);
        //   } catch (err) {
        //     console.log("FAILED TO CONNECT TO NATIVE HOST ", err);
        //   }
        // }
      } else {
        // USER SESSION NOT FOUND
      }

      tabHeaderStore = [];

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
      // chrome.downloads.cancel(item.id, function (_cancel) {
      //   tcLogger("[downloads] [cancel]", "Result ", _cancel);
      // });
      chrome.downloads.cancel(item.id, function (_cancel) {
        tcLogger("[downloads] [cancel]", "Result ", _cancel);
      });
    }

    // const [tab] = await chrome.tabs.query({
    //   active: true,
    //   lastFocusedWindow: true,
    // });
    let message = {
      source: SCRIPTS.BG_SCRIPT,
      action: ACTIONS.DOWNLOAD_APPROVAL,
      target: SCRIPTS.CONTENT_SCRIPT,
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

  if (
    request.source == SCRIPTS.APP_SCRIPT &&
    request.action == ACTIONS.USER_INFO
  ) {
    // saving user login info
    if (request.user) {
      await chrome.storage.local.set({ user: request.user });
    }
  } else if (
    request.source == SCRIPTS.CONTENT_SCRIPT &&
    request.action == ACTIONS.DOWNLOAD_APPROVAL
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
        tcLogger(
          "[runtime] [onMessage]",
          `DOWNLOADING VIA ${HOST_DESKTOP_APP} `,
          {
            request,
            sender,
            sendResponse,
          }
        );

        // let documentRequest = null;

        // if (documentRequest) {
        //   documentRequest = {
        //     requestId: request.requestId,
        //     type: parseInt(request.documentType),
        //   };
        // }

        captureDownload(request.selections, download);
      }
    }
  }
});

function subscribeToNativeHost(_data) {
  tcLogger(
    "[subscribeToNativeHost]",
    "starting to connect to native host",
    _data
  );
  try {
    // Connect to the native application
    port = chrome.runtime.connectNative(HOST_DESKTOP_APP);
  } catch (err) {
    console.log("FAILED TO CONNECT TO NATIVE HOST ", err);
  }

  tcLogger("[subscribeToNativeHost]", "PORT", port);

  // Add listener for the onConnect event
  // port.onConnect.addListener(function (nativePort) {
  isConnected = true;

  tcLogger(
    "[subscribeToNativeHost] [connected to app]",
    "Extension connected to app"
  );

  if (_data) {
    // Send a message to the native application
    port.postMessage(_data);
  }

  tcLogger(
    "[subscribeToNativeHost] [connected to app]",
    "Sent message ",
    _data
  );

  // console.log("Connected to native application");

  // Send a message to the native application
  // nativePort.postMessage({ message: "Hello from Chrome Extension!" });

  // Listen for messages from the native application
  port.onMessage.addListener(async function (msg) {
    tcLogger(
      "[subscribeToNativeHost] [received message from app]",
      "Received message ",
      msg
    );
    if (msg) {
      let msgToSend = {
        source: SCRIPTS.BG_SCRIPT,
        action: ACTIONS.DOWNLOAD_STATUS,
        target: SCRIPTS.CONTENT_SCRIPT,
        tabId: activeTabId,
        message: msg,
      };
      tcLogger(
        "[tabs] [sendMessage]",
        `SENDING MESSAGE TO TAB ${activeTabId}`,
        msgToSend
      );

      await chrome.tabs.sendMessage(activeTabId, msgToSend);
    }
  });

  // Handle disconnection from the native application
  port.onDisconnect.addListener(function () {
    isConnected = false;
    port = null;

    tcLogger(
      "[subscribeToNativeHost] [disconnected from app]",
      "Disconnection "
    );
  });
  // });
}

//
registerTabEvents();
registerWebRequestEvents();
registerDownloadsEvents();
// subscribeToNativeHost();
