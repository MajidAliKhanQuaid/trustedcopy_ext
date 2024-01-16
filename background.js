var headerStore = {};

// background.js

let uploadToServer = async (_blob) => {
  var myHeaders = new Headers();
  myHeaders.append("accept", "text/plain");
  let apiUrl = "https://trustedcopy.azurewebsites.net/api/document/save";
  // formData.append("file", blob, "filename.txt");
  var formdata = new FormData();
  formdata.append("deviceCode", "7B9LGYP3EK");
  formdata.append("local_ip", "127.0.0.1");
  formdata.append("public_ip", "10.10.10.10");
  formdata.append("local_datetime", "01/01/2023");
  formdata.append("timezone", "PKT");
  formdata.append("description", "Special Folder");
  formdata.append("attachment", _blob, "document");
  formdata.append("no_of_pages", "111");

  var requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: formdata,
    redirect: "follow",
  };

  // fetch(apiUrl, {
  //   method: "POST",
  //   body: formData,
  // })
  let data = await fetch(apiUrl, requestOptions);
  console.log("DATA ", data);
  let jsonResponse = await data.json();
  console.log("JSON Reponse ", jsonResponse);
  // .then((data) => {
  //   // Handle the response from the server
  //   console.log("Success:", data);
  // })
  // .catch((error) => {
  //   // Handle errors during the fetch
  //   console.error("Error:", error);
  // });
};

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

chrome.printerProvider.onGetCapabilityRequested.addListener(function (
  printerId,
  resultCallback
) {
  console.log(printerId);
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

chrome.printerProvider.onPrintRequested.addListener(async function (
  printJob,
  resultCallback
) {
  // Handle print request
  console.log("Print requested:", printJob);
  console.log("Result Callback ", resultCallback);
  // Simulate a successful print
  try {
    await uploadToServer(printJob.document);
    resultCallback("OK");
  } catch (err) {
    console.log("[onPrintRequested] FAILED TO UPLOAD ", err);
    resultCallback("FAILED");
  }
  console.log("PRINT COMPLETED");
});

// Listen for download events
chrome.downloads.onCreated.addListener(function (down) {
  // chrome.runtime.sendMessage({
  //   action: "",
  //   down: down,
  // });

  console.log("Download [OnCreate] [DownloadFileInfo] ", down);
  // sending message to tab
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var activeTab = tabs[0];
    let capturedRequest = null;
    let tabHeaderStore = headerStore[activeTab.id];
    if (tabHeaderStore && tabHeaderStore.request.length > 0) {
      console.log("COMPARING DOWN.URL ", down.url);
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
    console.log(
      "Download [OnCreate] [CapturedRequest]",
      headerStore[activeTab.id]
    );

    // let port = chrome.runtime.connectNative("com.trustedcopy.secure");
    // port.postMessage({ payload: JSON.stringify(request) });
    console.log("SENDING NATIVE MESSAGE ", capturedRequest);
    chrome.runtime.sendNativeMessage(
      "com.trustedcopy.secure",
      { data: capturedRequest },
      function (response) {
        console.log("RESPONSE FROM APP " + response);
      }
    );

    // chrome.tabs.sendMessage(activeTab.id, {
    //   message: "Received a document for upload",
    //   download: down,
    //   capturedRequest: capturedRequest,
    // });
  });
});

chrome.downloads.onChanged.addListener(function (delta) {
  console.log("On CHANGE ", delta);
  if (delta.state && delta.state.current === "complete") {
    // Download completed
    console.log("Download completed: ", delta.id);

    // You can perform additional actions here, if needed
  }
});

// chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
//   if (request.action === "download") {
//     const url = request.url;

//     chrome.downloads.download({ url: url }, function (downloadId) {
//       console.log("Download initiated with ID:", downloadId);

//       chrome.downloads.onChanged.addListener(function (delta) {
//         if (
//           delta.state &&
//           delta.state.current === "complete" &&
//           delta.id === downloadId
//         ) {
//           console.log("Sending ");
//           // sending message to tab
//           chrome.tabs.query(
//             { active: true, currentWindow: true },
//             function (tabs) {
//               var activeTab = tabs[0];
//               chrome.tabs.sendMessage(activeTab.id, {
//                 message: downloadId,
//               });
//             }
//           );
//         }
//       });
//     });
//   }
// });

function uploadFile(downloadId) {
  chrome.downloads.search({ id: downloadId }, function (downloads) {
    if (downloads.length > 0) {
      const downloadedFile = downloads[0];
      console.log("Downloaded file info:", downloadedFile);

      // Assuming you have a server endpoint for file upload
      const serverUploadEndpoint = "https://your-server/upload";

      // Use the Fetch API to upload the file to the server
      fetch(serverUploadEndpoint, {
        method: "POST",
        body: downloadedFile.filename, // This is just an example; adjust as needed
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("File uploaded successfully:", data);
        })
        .catch((error) => {
          console.error("Error uploading file:", error);
        });
    }
  });
}

/**
 * Cleanup headerStore when tab closes
 */
chrome.tabs.onRemoved.addListener(function (tabId) {
  delete headerStore[tabId];
});

chrome.webRequest.onSendHeaders.addListener(
  function (info) {
    console.log("WEB REQUEST ", info);
    //console.log("response received"+info.tabId);
    if (parseInt(info.tabId, 10) > 0) {
      // Initialize store

      activeTabId = info.tabId;
      if (typeof headerStore[info.tabId] === "undefined") {
        headerStore[info.tabId] = {};
        headerStore[info.tabId].request = [];
        headerStore[info.tabId].response = [];
      }

      if (info.url.indexOf("blob") > -1) {
        console.log("######## BLOB ", info);
      }

      headerStore[info.tabId].request.push(info);
      console.log("HEADER STORE ", headerStore);
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
