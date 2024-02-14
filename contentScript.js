const host = "https://localhost:44351";
let documentSaveUrl = `${host}/api/document/save`;
let pending = `${host}/api/document/requests/pending`;
const destinationServerUrl = "https://destination-server.com/upload";

const socketHost = "ws://localhost:8899"; // WebSocket server URL
let websocket;
let retryInterval = 1000; // Initial retry interval in milliseconds
const maxRetryInterval = 30000; // Maximum retry interval in milliseconds
let retries = 0;
const maxRetries = 10; // Maximum number of retry attempts

// document.addEventListener("DOMContentLoaded", () => {
//   console.log("FROM PAGE ", fromPageLocalStore);
//   try {
//     const key = "user";

//     // Get the current tab
//     chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
//       const tab = tabs[0];

//       // Execute script in the current tab
//       chrome.tabs.executeScript(
//         tab.id,
//         {
//           code: `localStorage['${key}']`,
//         },
//         function (result) {
//           console.log("FROM PAGE ", fromPageLocalStore);
//         }
//       );
//     });

//     // Store the result
//     // await chrome.storage.local.set({ [key]: fromPageLocalStore[0] });
//   } catch (err) {
//     // Log exceptions
//   }
// });

function trustedCopyLogin() {}
function connectWebSocket() {
  websocket = new WebSocket(url);

  websocket.onopen = function () {
    console.log("WebSocket connection established.");
    retries = 0; // Reset retry attempts upon successful connection
  };

  websocket.onmessage = function (event) {
    console.log("Message from server:", event.data);
  };

  websocket.onerror = function (error) {
    console.error("WebSocket error:", error);
    reconnectWebSocket(); // Attempt to reconnect upon error
  };

  websocket.onclose = function (event) {
    console.log("WebSocket connection closed:", event);
    reconnectWebSocket(); // Attempt to reconnect upon close
  };
}

function reconnectWebSocket() {
  // if (retries < maxRetries) {
  retries++;
  // const nextRetryInterval = Math.min(retryInterval * 2, maxRetryInterval); // Exponential backoff strategy
  const nextRetryInterval = Math.min(5000); // Exponential backoff strategy
  console.log(
    `Attempting to reconnect in ${nextRetryInterval} milliseconds (attempt ${retries}/${maxRetries})...`
  );
  setTimeout(connectWebSocket, nextRetryInterval); // Retry after the next interval
  retryInterval = nextRetryInterval;
  // }
  // else {
  //   console.log(
  //     "Maximum retry attempts reached. Could not establish WebSocket connection."
  //   );
  // }
}

function createModalDialog(_msg) {
  // Create a div element for the modal dialog
  var modalDiv = document.createElement("div");
  modalDiv.id = "modalDialog";
  modalDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: white;
      padding: 20px;
      border: 2px solid black;
      z-index: 9999;
  `;

  // Add content to the modal dialog
  modalDiv.innerHTML = `
      <div style="width: 250px; height: 250px;">
        <div>
          <h4>${_msg}</h4>
        </div>
        <button id="tcCloseModal">Close</button>
      </div>
  `;

  // Append the modal dialog to the body
  document.body.appendChild(modalDiv);

  // Add event listener to close the modal dialog
  document
    .getElementById("tcCloseModal")
    .addEventListener("click", function () {
      modalDiv.remove();
    });
}

function saveTrustedCopySession() {
  let currentHost = window.location.protocol + "//" + window.location.host;
  if (currentHost == host) {
    tcLogger("[Is Trusted Copy Site]", "Getting LocalStorage");
    let user = localStorage.getItem("user");
    if (user) {
      tcLogger(
        "[Is Trusted Copy Site]",
        "USER FOUND, NOW SENDING MESSAGE TO BG SCRIPT"
      );
      chrome.runtime.sendMessage({
        source: "TC#CS",
        action: "USER_INFO",
        user: user,
      });
    } else {
      tcLogger("[Is Trusted Copy Site]", "USER WAS NOT FOUND");
    }
  }
}

function trustedCopyRegister() {
  // try {
  //   var port = chrome.runtime.connectNative("com.trustedcopy.secure");

  //   port.onMessage.addListener(function (msg) {
  //     console.log("RECEIVED MESSAGE FROM DESKTOP APP ||| " + msg);
  //   });

  //   port.onDisconnect.addListener(function () {
  //     console.log("[DISCONNECTED] TO DESKTOP APP com.trustedcopy.secure");
  //   });
  // } catch (err) {
  //   console.log("---------- FAILED TO CONNECT");
  //   alert(
  //     "Failed to connect to Desktop App, please start the trustedcopy desktop app"
  //   );
  // }
  saveTrustedCopySession();

  // background.js
  tcLogger("[runtime] [onMessage]", "REGISTER");
  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      tcLogger("[runtime] [onMessage]", "CALLBACK ", {
        request,
        sender,
        sendResponse,
      });
      createModalDialog("Do you want to save the file to the Vault?");
      let userConfirmation = confirm(
        "Do you want to save the file to the Vault?"
      );
      console.log(
        "[runtime] [onMessage]",
        "CALLBACK USER_SELECTION",
        userConfirmation
      );

      await chrome.runtime.sendMessage({
        source: "TC#CS",
        action: "DOWNLOAD_APPROVAL",
        tabId: request.tabId,
        download: request.download,
        saveToVault: userConfirmation,
      });
    }
  );
}

function readFileFromServerAndUpload(_req) {
  let headers = {};
  if (_req.capturedRequest && _req.capturedRequest.requestHeaders) {
    let capturedHeaders = _req.capturedRequest.requestHeaders;

    capturedHeaders.forEach((item) => {
      headers[item.name.toLowerCase()] = item.value;
    });
  }
  console.log("HEADERS ", headers);

  console.log("CALLING [readFileFromServerAndUpload]");
  // Replace these URLs with the actual URLs of the servers
  console.log("BEFORE ENCODING ", _req.download.finalUrl);
  const sourceServerUrl = decodeURIComponent(_req.download.finalUrl);
  console.log("AFTER ENCODING ", _req.download.finalUrl);
  //   let apiUrl = "https://trustedcopy.azurewebsites.net/api/document/save";

  // Fetch the file from the source server
  fetch(sourceServerUrl, {
    headers: headers,
    credentials: "include",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to fetch the file from the source server.");
      }
      return response.blob();
    })
    .then((fileBlob) => {
      console.log("READ SUCCESS we've the BLOB");
      // Upload the file to the destination server
      uploadFileToServer(documentSaveUrl, fileBlob);
    })
    .catch((error) => {
      console.error("[readFileFromServerAndUpload] Error:", error);
    });
}

function uploadFileToServer(destinationUrl, fileBlob) {
  console.log("CALLING [uploadFileToServer]");
  // Create a FormData object and append the file blob to it
  var formdata = new FormData();
  formdata.append("deviceCode", "7B9LGYP3EK");
  formdata.append("local_ip", "127.0.0.1");
  formdata.append("public_ip", "10.10.10.10");
  formdata.append("local_datetime", "01/01/2023");
  formdata.append("timezone", "PKT");
  formdata.append("description", "Special Folder");
  formdata.append("attachment", fileBlob, "document");
  formdata.append("no_of_pages", "111");

  // Make an HTTP request to upload the file to the destination server
  fetch(destinationUrl, {
    method: "POST",
    body: formdata,
  })
    .then((response) => {
      if (response.ok) {
        alert("File uploaded successfully to the destination server.");
      } else {
        alert("Error uploading file to the destination server.");
      }
    })
    .catch((error) => {
      console.error("[uploadFileToServer] ERROR:", error);
    });
}

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

async function getPendingRequests(_token) {
  try {
    const response = await fetch(pending, {
      headers: {
        Authorization: `Bearer ${_token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    console.log("Pending Requests : ", data); // Handle the data received from the server
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
  }
}

let tt =
  "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiI5YWVhOGYwMC02OWVjLTQ4NzItOGVjMi0yMjJhYWRhZDA5YTMiLCJ1bmlxdWVfbmFtZSI6IjlhZWE4ZjAwLTY5ZWMtNDg3Mi04ZWMyLTIyMmFhZGFkMDlhMyIsInJvbGUiOiJNZW1iZXIiLCJlbWFpbCI6ImNvbnRhY3RtYWtxQGdtYWlsLmNvbSIsIm5iZiI6MTcwNzgzMDI5NywiZXhwIjoxNzA4NDM1MDk3LCJpYXQiOjE3MDc4MzAyOTd9.RobKIGC7C2DRpXMeobY--fhPvC_e7Wc9cvqnJr6hb9PbNxqxc7RB1BcRLEVIOKV61UjjF8WaSNUSRb9WMQY4lQ";

trustedCopyRegister();
// getPendingRequests(tt);
// Initial connection attempt
// connectWebSocket();
