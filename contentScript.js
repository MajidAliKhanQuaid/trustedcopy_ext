/*
<consts_variables>
*/
const types = [
  { label: "Bank Statement", value: "0" },
  { label: "Utililty Bills", value: "1" },
  { label: "Paystub", value: "2" },
  { label: "Degree Transcript", value: "3" },
  { label: "W2 Tax Return", value: "4" },
];

const SCRIPTS = {
  BG_SCRIPT: "TC#BG",
  CONTENT_SCRIPT: "TC#CS",
  POPUP_SCRIPT: "TC#PP",
};

const ACTIONS = {
  DOWNLOAD_APPROVAL: "DOWNLOAD_APPROVAL",
  DOWNLOAD_STATUS: "DOWNLOAD_STATUS",
  USER_INFO: "USER_INFO",
};

const HOST_FE = "http://localhost:3000";
const HOST_API = "https://localhost:44351";
const DOC_SAVE_URL = `${HOST_API}/api/document/save`;
const PENDING_REQUESTS_URL = `${HOST_API}/api/document/requests/pending`;
let pendingRequests = [];
let tcDom = null;
//
// let currentHost = window.location.protocol + "//" + window.location.host;
// if (currentHost == HOST_FE) {
//   alert("[Extension] Welcome to Trusted Copy Site");
// }
//
const destinationServerUrl = "https://destination-server.com/upload";

class TcDom {
  getCheckbox(_type, _id) {
    let html = `
    <label class="tc__cb_cont">
      <input type="checkbox" class="tc__cb" data-req-type="${_type}" data-req-id="${_id}">
      <span class="checkmark"></span>
    </label>`;
    let tempEl = document.createElement("div");
    tempEl.innerHTML = html;
    return tempEl.firstElementChild;
  }

  uncheckAllExceptOne(_type, _id) {
    let shadowRoot = document.querySelector(".tc__host").shadowRoot;
    shadowRoot.querySelectorAll("input[type=checkbox]").forEach((el) => {
      let type = el.getAttribute("data-req-type");
      let reqId = el.getAttribute("data-req-id");
      if (!(type == _type && _id == reqId)) {
        el.checked = false;
      }
    });
  }

  getSelectedOption() {
    let selectedOption = null;
    let shadowRoot = document.querySelector(".tc__host").shadowRoot;
    shadowRoot.querySelectorAll("input[type=checkbox]").forEach((el) => {
      if (el.checked) {
        let type = el.getAttribute("data-req-type");
        let reqId = el.getAttribute("data-req-id");
        selectedOption = {
          type,
          requestId: reqId,
        };
      }
    });

    return selectedOption;
  }
}

// const SOCKET_HOST = "ws://localhost:8899"; // WebSocket server URL
const SOCKET_HOST = "ws://localhost:8080"; // WebSocket server URL
let websocket;
let retryInterval = 1000; // Initial retry interval in milliseconds
const maxRetryInterval = 30000; // Maximum retry interval in milliseconds
let retries = 0;
const maxRetries = 10; // Maximum number of retry attempts

async function getPendingRequests(_token) {
  try {
    const response = await fetch(PENDING_REQUESTS_URL, {
      headers: {
        Authorization: `Bearer ${_token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();
    console.log("[PopUp] Pending Requests : ", data); // Handle the data received from the server
    return data;
  } catch (error) {
    console.error(
      "[PopUp] There was a problem with the fetch operation:",
      error
    );
  }
}
/*
</consts_variables>
*/
function connectWebSocket() {
  console.log("[contentScript][Socket] calling connectWebSocket");
  websocket = new WebSocket(SOCKET_HOST);

  websocket.onopen = function () {
    console.log("[Socket] [onopen]");
    retries = 0; // Reset retry attempts upon successful connection
  };

  websocket.onmessage = function (event) {
    console.log("[Socket] [onmessage]", event.data);
    alert("File has been saved to vault");
  };

  websocket.onerror = function (error) {
    console.error("[Socket] [onerror]", error);
    reconnectWebSocket(); // Attempt to reconnect upon error
  };

  websocket.onclose = function (event) {
    console.log("[Socket] [onclose]", event);
    reconnectWebSocket(); // Attempt to reconnect upon close
  };
}

function reconnectWebSocket() {
  if (retries < maxRetries) {
    retries++;
    const nextRetryInterval = Math.min(retryInterval * 2, maxRetryInterval); // Exponential backoff strategy
    // const nextRetryInterval = Math.min(nextRetryInterval); // Exponential backoff strategy
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
}

function getPendingRequestsUI() {
  let elements = pendingRequests.map(function (pr) {
    return pr.type.map(function (prType) {
      console.log("PENDING REQUEST ", pr);
      console.log("PENDING REQUEST TYPE ", prType);
      // Create the main container div with class "tc__pr"
      const tcPrDiv = document.createElement("div");
      tcPrDiv.classList.add("tc__pr");

      // Create the div with class "tc__pr_headings"
      const tcPrHeadingsDiv = document.createElement("div");
      tcPrHeadingsDiv.classList.add("tc__pr_headings");

      // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
      const tcPrRequestCodeDiv = document.createElement("div");
      tcPrRequestCodeDiv.classList.add("tc__pr_req_code");
      tcPrRequestCodeDiv.innerText = pr.code;
      tcPrHeadingsDiv.appendChild(tcPrRequestCodeDiv);

      // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
      const tcPrOrgNameDiv = document.createElement("div");
      tcPrOrgNameDiv.classList.add("tc__pr_org_name");
      tcPrOrgNameDiv.innerText = pr.requestingOrg;
      tcPrHeadingsDiv.appendChild(tcPrOrgNameDiv);

      // Create the div with class "tc__pr_doc_type" and append it to "tc__pr_headings"
      const tcPrDocTypeDiv = document.createElement("div");
      tcPrDocTypeDiv.classList.add("tc__pr_doc_type");
      let docType = types.find((t) => t.value == prType);
      if (docType) {
        tcPrDocTypeDiv.innerText = docType.label;
      }
      tcPrHeadingsDiv.appendChild(tcPrDocTypeDiv);

      // Create the div with class "tc__pr_selection"
      const tcPrSelectionDiv = document.createElement("div");
      tcPrSelectionDiv.classList.add("tc__pr_selection");

      // Create the input element with type checkbox and append it to "tc__pr_selection"
      // const checkboxInput = document.createElement("input");
      // checkboxInput.setAttribute("type", "checkbox");
      // checkboxInput.setAttribute("class", "");
      // checkboxInput.setAttribute("data-id", "");
      const checkboxInput = tcDom.getCheckbox(prType, pr.id);
      // console.log("CHECKBOX ", checkboxInput);
      tcPrSelectionDiv.appendChild(checkboxInput);

      // Append "tc__pr_headings" and "tc__pr_selection" to the main container "tc__pr"
      tcPrDiv.appendChild(tcPrHeadingsDiv);
      tcPrDiv.appendChild(tcPrSelectionDiv);

      return tcPrDiv;
    });
  });

  console.log("ELEMENTS ", elements);

  let requestsContainer = document.createElement("div");
  let flattened = elements.flat(1);
  flattened.forEach((element) => {
    requestsContainer.appendChild(element);
  });
  // console.log("FLATTEN 1 ", afterFlatten1);
  // let afterFlatten2 = [].concat.apply([], arrays);
  // console.log("FLATTEN 2 ", afterFlatten2);
  return requestsContainer;
}

function createModalDialog(_title, _reponsePayload) {
  let icon_url = chrome.runtime.getURL("images/icon.png");
  let logo_url = chrome.runtime.getURL("images/logo_text.png");

  // console.log("URL ", url);
  // Create a div element for the modal dialog
  let tcModalDialog = document.createElement("div");
  tcModalDialog.id = "tc__modal_dialog";
  // tcModalDialog.style.cssText = `
  //     position: fixed;
  //     top: 50%;
  //     left: 50%;
  //     transform: translate(-50%, -50%);
  //     background-color: white;
  //     padding: 20px;
  //     border: 2px solid black;
  //     z-index: 9999;
  // `;

  // Add content to the modal dialog
  tcModalDialog.innerHTML = `
  <style>
    .d-flex {
      display: flex;
    }
  </style>

      <style>
      /* Customize the label (the tc__cb_cont) */
      .tc__cb_cont {
        display: block;
        position: relative;
        padding-left: 35px;
        margin-bottom: 12px;
        cursor: pointer;
        font-size: 22px;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
      }
      
      /* Hide the browser's default checkbox */
      .tc__cb_cont input {
        position: absolute;
        opacity: 0;
        cursor: pointer;
        height: 0;
        width: 0;
      }
      
      /* Create a custom checkbox */
      .checkmark {
        position: absolute;
        top: 0;
        left: 0;
        height: 25px;
        width: 25px;
        background-color: #eee;
      }
      
      /* On mouse-over, add a grey background color */
      .tc__cb_cont:hover input ~ .checkmark {
        background-color: #ccc;
      }
      
      /* When the checkbox is checked, add a blue background */
      .tc__cb_cont input:checked ~ .checkmark {
        background-color: rgb(22, 193, 123);
      }
      
      /* Create the checkmark/indicator (hidden when not checked) */
      .checkmark:after {
        content: "";
        position: absolute;
        display: none;
      }
      
      /* Show the checkmark when checked */
      .tc__cb_cont input:checked ~ .checkmark:after {
        display: block;
      }
      
      /* Style the checkmark/indicator */
      .tc__cb_cont .checkmark:after {
        left: 9px;
        top: 5px;
        width: 5px;
        height: 10px;
        border: solid white;
        border-width: 0 3px 3px 0;
        -webkit-transform: rotate(45deg);
        -ms-transform: rotate(45deg);
        transform: rotate(45deg);
      }
</style>

<style>
.tc__modal_backdrop {
  display: none;
  position: fixed;
  z-index: 9998;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.4);
}
</style>

<style>
        #tc__modal_dialog {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background-color: rgba(0, 0, 0, 0.5);
          padding: 15px;
          border: 2px solid black;
          z-index: 9999;
          width: 100%;
          height: 100%;
          z-index: 9998;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tc__modal_content {
          background: white; 
          /*min-width: 250px; 
          max-width: 600px; 
          min-height: 300px; 
          max-height: 800px; 
          height: 75vh; 
          width: 75%;*/
          height: 500px;
          width: 400px;
          padding: 5px;
        }

        .tc__pending_req_container {
          overflow-y: auto; 
          height: 325px;
        }

        .tc__pr {
          background-color: #f7f7f7;
          margin: 10px 0px;
        }

        .tc__pr_headings {
          flex: 1;
        }

        .tc__pr {
          display: flex;
          padding: 10px 5px;
        }

        .tc__btn {
          border-radius: 9999px;
          padding: 10px;
          margin: 10px;
          outline: 2px solid transparent; 
          border: 2px solid transparent; 
        }

.tc__btns_container {
  display: flex;
  margin: 10px 0px;
  justify-content: flex-end;
}

        #tc__save_to_vault {
          background: #19BF7A;
          color: white;
        }

.tc__pr_selection {
  display: flex;
  justify-content: center;
}

        #tc__close_modal {
          background: red;
          color: white;
        }
      
      .tc__pr_doc_type {
          font-weight: bold;
          color: #757a8a;
      }

        </style>


      <div class="tc__modal_content">
      <div class="d-flex m-15">
        <div>
          <img src="${icon_url}">
        </div>
        <div class="d-flex v-center">
          <div style="margin-top: 7px; margin-left: 10px">
            <img src="${logo_url}" width="100%">
          </div>
        </div>
      </div>
      <hr />
        <div class="tc__modal_backdrop"></div>
        <h4>Pending Requests</h4>  
        <div class="tc__pending_req_container">
          ${getPendingRequestsUI().outerHTML}
        </div>
        <div class="tc__btns_container">
          <button class="tc__btn" id="tc__close_modal">Cancel</button>
          <button class="tc__btn" id="tc__save_to_vault">Save to Vault</button>
        </div>
      </div>
  `;

  let shadowRoot = document.querySelector(".tc__host").shadowRoot;
  // let host = document.querySelector(".tc__host");
  // let root = host.attachShadow({ mode: "open" });
  // // appending to the shadow
  // root.textContent = "";
  shadowRoot.appendChild(tcModalDialog);

  // Append the modal dialog to the body
  // document.body.appendChild(tcModalDialog);

  var checkboxes = shadowRoot.querySelectorAll(".tc__cb");

  for (let i = 0; i < checkboxes.length; i++) {
    checkboxes[i].addEventListener("change", async function () {
      let type = this.getAttribute("data-req-type");
      let id = this.getAttribute("data-req-id");
      tcDom.uncheckAllExceptOne(type, id);

      // console.log("Is Checked ", this.checked);
      // console.log("Is Checked ", this.getAttribute("data-req-type"));
      // console.log("Is Checked ", this.getAttribute("data-req-id"));
    });
  }

  shadowRoot
    .querySelector("#tc__save_to_vault")
    .addEventListener("click", async function () {
      let selection = tcDom.getSelectedOption();
      if (!selection) {
        alert("Please select an option");
        return;
      }

      var request = selection.requestId;
      var type = selection.type;

      if (!request) {
        alert("Please select a request");
        return;
      }

      if (isNaN(type)) {
        alert("Please select a document type");
        return;
      }

      _reponsePayload.saveToVault = true;
      _reponsePayload.requestId = request;
      _reponsePayload.documentType = type;

      await chrome.runtime.sendMessage(_reponsePayload);
    });

  shadowRoot
    .querySelector("#tc__close_modal")
    .addEventListener("click", async function () {
      let root = document.querySelector(".tc__host").shadowRoot;
      // appending to the shadow
      root.textContent = "";

      _reponsePayload.saveToVault = false;

      await chrome.runtime.sendMessage(_reponsePayload);
    });
}

function getDropdown(_name, options) {
  // Create a select element
  var selectElement = document.createElement("select");
  selectElement.id = _name;

  // Create and append options to the select element
  for (var i = 0; i < options.length; i++) {
    var option = document.createElement("option");
    option.value = options[i].value;
    option.text = options[i].text;
    selectElement.appendChild(option);
  }

  // Append the select element to a container (for example, the body)
  return selectElement;
}

// async function saveTrustedCopySession() {
//   let currentHost = window.location.protocol + "//" + window.location.host;
//   if (currentHost == HOST_FE) {
//     tcLogger("[Is Trusted Copy Site]", "Getting LocalStorage");
//     let user = localStorage.getItem("user");
//     // if (user) {
//     //   tcLogger(
//     //     "[Is Trusted Copy Site]",
//     //     "USER FOUND, NOW SENDING MESSAGE TO BG SCRIPT"
//     //   );
//     //   // chrome.runtime.sendMessage({
//     //   //   source: SCRIPTS.CONTENT_SCRIPT,
//     //   //   action: ACTIONS.USER_INFO,
//     //   //   target: SCRIPTS.BG_SCRIPT,
//     //   //   user: user,
//     //   // });
//     //   await chrome.storage.local.set({ user: request.user });
//     // } else {
//     //   tcLogger("[Is Trusted Copy Site]", "USER WAS NOT FOUND");
//     // }
//   }
// }

async function tc__init() {
  tcDom = new TcDom();

  let hostEl = document.createElement("div");
  hostEl.classList.add("tc__host");
  document.body.appendChild(hostEl);

  let host = document.querySelector(".tc__host");
  let root = host.attachShadow({ mode: "open" });
  // appending to the shadow
  root.textContent = "";
  document.body.appendChild(root);

  // adding host element for shadow to avoid css conflicts
  // let hostElement = document.createElement("div");
  // hostElement.classList.add("tc__host");
  // document.body.appendChild(hostElement);

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
  // saveTrustedCopySession();

  let user = await chrome.storage.local.get(["user"]);
  if (user.user) {
    let userObject = JSON.parse(user.user);
    let requests = await getPendingRequests(userObject.access_token);
    if (requests) {
      pendingRequests = requests;
      // createModalDialog("Trusted Copy", null);
    }
    console.log("[contentScript] onRegister ", userObject);
  }

  // background.js
  tcLogger("[Content Script] [runtime] [onMessage]", "REGISTER");
  chrome.runtime.onMessage.addListener(
    async (request, sender, sendResponse) => {
      tcLogger("[Content Script] [runtime] [onMessage]", "CALLBACK ", {
        request,
        sender,
        sendResponse,
      });

      if (request.action == ACTIONS.DOWNLOAD_APPROVAL) {
        let responsePayload = {
          source: SCRIPTS.CONTENT_SCRIPT,
          action: ACTIONS.DOWNLOAD_APPROVAL,
          target: SCRIPTS.BG_SCRIPT,
          tabId: request.tabId,
          download: request.download,
          requestId: null,
          documentType: null,
          saveToVault: false, // not sure until now
        };
        createModalDialog(
          "Do you want to save the file to the Vault?",
          responsePayload
        );
      } else if (request.action == ACTIONS.DOWNLOAD_STATUS) {
        if (request.message.IsSuccess) {
          let root = document.querySelector(".tc__host").shadowRoot;
          // appending to the shadow
          root.textContent = "";
          alert("Uploaded with success");
        } else {
          alert("Failed to upload");
        }
      }
      // let userConfirmation = confirm(
      //   "Do you want to save the file to the Vault?"
      // );
      // console.log(
      //   "[Content Script] [runtime] [onMessage]",
      //   "CALLBACK USER_SELECTION",
      //   userConfirmation
      // );

      // await chrome.runtime.sendMessage({
      //   source: SCRIPTS.CONTENT_SCRIPT,
      //   action: ACTIONS.DOWNLOAD_APPROVAL,
      //   target: SCRIPTS.BG_SCRIPT,
      //   tabId: request.tabId,
      //   download: request.download,
      //   saveToVault: userConfirmation,
      // });
    }
  );

  // connectWebSocket();
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
      uploadFileToServer(DOC_SAVE_URL, fileBlob);
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

// listener for listening messages on login/logout from react app
window.addEventListener("message", async function (event) {
  // Check if the message is from a trusted source
  if (event.origin === HOST_FE) {
    // Handle messages from the webpage
    console.log("[contentScript] New Msg Received ", event);
    console.log("[contentScript] Payload ", event.data.payload);

    if (event.data.action == "SIGN_IN") {
      let setResult = await chrome.storage.local.set({
        user: event.data.payload,
      });
      console.log("[contentScript] setResult ", setResult);
    } else if (event.data.action == "SIGN_OUT") {
      let removeResult = await chrome.storage.local.remove(["user"]);
      console.log("[contentScript] removeResult ", removeResult);
    }
  }
});

tc__init();
// getPendingRequests(tt);
// initial connection attempt
// connectWebSocket();
