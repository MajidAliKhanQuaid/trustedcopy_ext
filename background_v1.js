/*
registerPrinterEvents
registerDownloadsEvents
registerWebRequestEvents
registerTabEvents
*/

let headerStore = {};
let apiUrl = "";

let registerPrinterEvents = function () {
  tcLogger("REGISTER [printerProvider] [onGetPrintersRequested]");
  chrome.printerProvider.onGetPrintersRequested.addListener(function (
    resultCallback
  ) {
    resultCallback([
      {
        id: "trustedcopy_printer",
        name: "Trusted Copy Printer",
        description: "",
      },
    ]);
  });

  tcLogger("REGISTER [printerProvider] [onGetCapabilityRequested]");
  chrome.printerProvider.onGetCapabilityRequested.addListener(function (
    printerId,
    resultCallback
  ) {
    tcLogger(printerId);
    if (printerId == "trustedcopy_printer") {
      resultCallback({
        version: "1.0",
        printer: {
          supported_content_type: [
            { content_type: "application/pdf", min_version: "1.5" },
            { content_type: "image/jpeg" },
            { content_type: "text/plain" },
          ],
          input_tray_unit: [
            {
              vendor_id: "tray",
              type: "INPUT_TRAY",
            },
          ],
          marker: [
            {
              vendor_id: "black",
              type: "INK",
              color: { type: "BLACK" },
            },
            {
              vendor_id: "color",
              type: "INK",
              color: { type: "COLOR" },
            },
          ],
          cover: [
            {
              vendor_id: "front",
              type: "CUSTOM",
              custom_display_name: "front cover",
            },
          ],
          vendor_capability: [],
          color: {
            option: [
              { type: "STANDARD_MONOCHROME" },
              { type: "STANDARD_COLOR", is_default: true },
              {
                vendor_id: "ultra-color",
                type: "CUSTOM_COLOR",
                custom_display_name: "Best Color",
              },
            ],
          },
          copies: {
            default: 1,
            max: 100,
          },
          media_size: {
            option: [
              {
                name: "ISO_A4",
                width_microns: 210000,
                height_microns: 297000,
                is_default: true,
              },
              {
                name: "NA_LEGAL",
                width_microns: 215900,
                height_microns: 355600,
              },
              {
                name: "NA_LETTER",
                width_microns: 215900,
                height_microns: 279400,
              },
            ],
          },
        },
      });
    }
  });

  tcLogger("REGISTER [printerProvider] [onPrintRequested]");
  chrome.printerProvider.onPrintRequested.addListener(async function (
    printJob,
    resultCallback
  ) {
    tcLogger("CALLBACK [printerProvider] [onPrintRequested]");
    try {
      await uploadBlobToServer(printJob.document, "document.pdf");
      resultCallback("OK");
    } catch (err) {
      tcLogger(
        "CALLBACK ERROR [printerProvider] [onPrintRequested] ",
        {
          printJob,
          err,
        },
        true
      );
      tcLogger("[onPrintRequested] FAILED TO UPLOAD ", err);
      resultCallback("FAILED");
    }
    tcLogger("CALLBACK PRINT_COMPLETED [printerProvider] [onPrintRequested]");
  });
};

let registerDownloadsEvents = function () {
  // Listen for download events
  tcLogger("REGISTER [downloads] [onCreated]");
  chrome.downloads.onCreated.addListener(function (down) {
    // chrome.runtime.sendMessage({
    //   action: "",
    //   down: down,
    // });

    tcLogger("Download [OnCreate] [DownloadFileInfo] ", down);
    // sending message to tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var activeTab = tabs[0];
      let capturedRequest = null;
      let tabHeaderStore = headerStore[activeTab.id];
      if (tabHeaderStore && tabHeaderStore.request.length > 0) {
        tcLogger("COMPARING DOWN.URL ", down.url);
        capturedRequest = tabHeaderStore.request.find(
          (req) => req.url == down.url
        );
        // if request not found, then get the last request and take the headers from it
        if (!capturedRequest) {
          capturedRequest =
            tabHeaderStore.request[tabHeaderStore.request.length - 1];
          if (capturedRequest) {
            capturedRequest.url = down.url;
          }
        }
      }
      tcLogger(
        "Download [OnCreate] [CapturedRequest]",
        headerStore[activeTab.id]
      );

      // let port = chrome.runtime.connectNative("com.trustedcopy.secure");
      // port.postMessage({ payload: JSON.stringify(request) });
      tcLogger("SENDING NATIVE MESSAGE ", capturedRequest);
      chrome.runtime.sendNativeMessage(
        "com.trustedcopy.secure",
        { data: capturedRequest },
        function (response) {
          tcLogger("RESPONSE FROM APP " + response);
        }
      );

      // chrome.tabs.sendMessage(activeTab.id, {
      //   message: "Received a document for upload",
      //   download: down,
      //   capturedRequest: capturedRequest,
      // });
    });
  });

  tcLogger("REGISTER [downloads] [onChanged]");
  chrome.downloads.onChanged.addListener(function (_change) {
    tcLogger("CALLBACK [downloads] [onChanged] ", _change);
    if (delta.state && delta.state.current === "complete") {
      tcLogger(
        "CALLBACK DOWNLOAD COMPLETED [downloads] [onChanged] ",
        _change.id
      );
    }
  });
};

let registerWebRequestEvents = function () {
  tcLogger("REGISTER [webRequest] [onSendHeaders]");
  chrome.webRequest.onSendHeaders.addListener(
    function (info) {
      tcLogger("CALLBACK [webRequest] [onSendHeaders]", info);
      //tcLogger("response received"+info.tabId);
      if (parseInt(info.tabId, 10) > 0) {
        // Initialize store

        activeTabId = info.tabId;
        if (typeof headerStore[info.tabId] === "undefined") {
          headerStore[info.tabId] = {};
          headerStore[info.tabId].request = [];
          headerStore[info.tabId].response = [];
        }

        if (info.url.indexOf("blob") > -1) {
          tcLogger("CALLBACK **BLOB** [webRequest] [onSendHeaders]", info);
        }

        headerStore[info.tabId].request.push(info);
      }
    },
    {
      urls: ["http://*/*", "https://*/*"],
      types: [
        "main_frame",
        "sub_frame",
        "image",
        "object",
        "xmlhttprequest",
        "other",
      ],
      //types: ['main_frame','sub_frame','stylesheet','script','image','object','xmlhttprequest','other']
    },
    ["requestHeaders", "extraHeaders"]
  );
};

let registerTabEvents = function () {
  /**
   * Cleanup headerStore when tab closes
   */
  tcLogger("REGISTER [tabs] [onRemoved]");
  chrome.tabs.onRemoved.addListener(function (tabId) {
    delete headerStore[tabId];
  });
};

let searchDownloadedFileAndUpload = function (downloadId) {
  tcLogger("REGISTER [downloads] [search]");
  chrome.downloads.search({ id: downloadId }, function (downloads) {
    if (downloads.length > 0) {
      const downloadedFile = downloads[0];
      tcLogger("CALLBACK [downloads] [search] ", downloadedFile);

      // Assuming you have a server endpoint for file upload
      const serverUploadEndpoint = "https://your-server/upload";

      // Use the Fetch API to upload the file to the server
      fetch(serverUploadEndpoint, {
        method: "POST",
        body: downloadedFile.filename, // This is just an example; adjust as needed
      })
        .then((response) => response.json())
        .then((data) => {
          tcLogger(
            "CALLBACK FILE UPLOADED Successfully [downloads] [search] ",
            data
          );
        })
        .catch((error) => {
          console.error("ERROR FILE UPLOADING [downloads] [search] ", error);
        });
    }
  });
};

// background.js

let uploadBlobToServer = async function (_blob, _filename) {
  var myHeaders = new Headers();
  myHeaders.append("accept", "text/plain");
  var formdata = new FormData();
  formdata.append("deviceCode", "7B9LGYP3EK");
  formdata.append("local_ip", "127.0.0.1");
  formdata.append("public_ip", "10.10.10.10");
  formdata.append("local_datetime", "01/01/2023");
  formdata.append("timezone", "PKT");
  formdata.append("description", "Special Folder");
  formdata.append("attachment", _blob, _filename);
  formdata.append("no_of_pages", "111");

  var requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: formdata,
    redirect: "follow",
  };

  let data = await fetch(apiUrl, requestOptions);
  tcLogger("DATA ", data);
  let jsonResponse = await data.json();
  tcLogger("JSON Reponse ", jsonResponse);
};

let tcLogger = function (_msg, _params, _error) {
  if (_error) {
    if (_params) {
      console.error(_msg, _params);
      return;
    }
    console.error(_msg);
    return;
  }
  if (_params) {
    console.log(_msg, _params);
    return;
  }
  console.log(_msg);
};

//
registerTabEvents();
registerWebRequestEvents();
registerDownloadsEvents();
registerPrinterEvents();
