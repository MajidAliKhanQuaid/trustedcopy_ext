/*
<consts_variables>
*/
// const types = [
//   { label: "Bank Statement", value: "0" },
//   { label: "Utililty Bills", value: "1" },
//   { label: "Paystub", value: "2" },
//   { label: "Degree Transcript", value: "3" },
//   { label: "W2 Tax Return", value: "4" },
// ];

const SCRIPTS = {
  BG_SCRIPT: "TC#BG",
  CONTENT_SCRIPT: "TC#CS",
  POPUP_SCRIPT: "TC#PP",
};

const ACTIONS = {
  DOWNLOAD_APPROVAL: "DOWNLOAD_APPROVAL",
  DOWNLOAD_STATUS: "DOWNLOAD_STATUS",
  USER_INFO: "USER_INFO",
  NATIVE_HOST_CONNECT: "NATIVE_HOST_CONNECT",
};

let manifest = chrome.runtime.getManifest();
console.log("CONTENT SCRIPT MANIFEST ", manifest);

const HOST_FE = manifest.tc_host_fe_app;
const HOST_API = manifest.tc_host_api;
const DOC_SAVE_URL = `${HOST_API}/api/${manifest.tc_api_save_docs_path}`;
const PENDING_REQUESTS_URL = `${HOST_API}/api/${manifest.tc_api_pending_docs_path}`;

let pendingRequests = [];
let documentTypes = [];
let tcDom = null;
//
// let currentHost = window.location.protocol + "//" + window.location.host;
// if (currentHost == HOST_FE) {
//   alert("[Extension] Welcome to Trusted Copy Site");
// }
//

function formatRequest(_req) {
  let formattedDate = "";
  if (_req.startMonth && _req.startYear) {
    let startDate = "";
    startDate = new Date(
      `${_req.startYear}-${_req.startMonth + 1}-1`
    ).toLocaleString("en-us", {
      month: "long",
      year: "numeric",
    });
    formattedDate = startDate;
  }

  if (_req.endMonth && _req.endYear) {
    let endDate = "";
    endDate = new Date(`${_req.endYear}-${_req.endMonth + 1}-1`).toLocaleString(
      "en-us",
      {
        month: "long",
        year: "numeric",
      }
    );
    formattedDate += " - " + endDate;
  }

  return formattedDate;
}

function groupObjectsByDate(array) {
  const groupedObjects = {};

  array.forEach((obj) => {
    // const key = `${obj.startMonth || "null"}-${obj.startYear || "null"}-${
    //   obj.endMonth || "null"
    // }-${obj.endYear || "null"}`;
    const key = formatRequest(obj);
    if (!groupedObjects[key]) {
      groupedObjects[key] = [];
    }
    groupedObjects[key].push(obj);
  });

  return groupedObjects;
}

const destinationServerUrl = "https://destination-server.com/upload";

class TcDom {
  getCheckbox(_type, _id, _index) {
    let _class = `tc__cb_${_index}`;
    let _checked = _index == 0;
    let _disabled = _index > 0;

    let html = `
    <label class="tc__cb_cont">
      <input type="checkbox" class="tc__cb ${_class}" data-req-type="${_type}" data-req-id="${_id}" ${
      _checked ? "checked" : ""
    } ${_disabled ? "disabled" : ""}>
      <span class="checkmark"></span>
    </label>`;
    let tempEl = document.createElement("div");
    tempEl.innerHTML = html;
    return tempEl.firstElementChild;
  }

  toggleCheckboxes(_id) {
    let shadowRoot = document.querySelector(".tc__host").shadowRoot;
    shadowRoot.querySelectorAll("input[type=checkbox]").forEach((el) => {
      el.checked = el.classList.contains(`tc__cb_${_id}`);
      el.disabled = !el.classList.contains(`tc__cb_${_id}`);
    });
  }

  getSelectedOption() {
    let selectedOptions = [];
    let shadowRoot = document.querySelector(".tc__host").shadowRoot;
    shadowRoot.querySelectorAll("input[type=checkbox]").forEach((el) => {
      if (el.checked) {
        let type = el.getAttribute("data-req-type");
        let reqId = el.getAttribute("data-req-id");
        let selectedOption = {
          type,
          requestId: reqId,
        };
        selectedOptions.push(selectedOption);
      }
    });

    return selectedOptions;
  }

  getRadio(_type, _id) {
    let _checked = _id == 0;
    let html = `<label>
    <input type="radio" name="rad_request" value="${_id}" ${
      _checked ? "checked" : ""
    }>
    <span class="tc__radio"></span></label>`;
    let tempEl = document.createElement("div");
    tempEl.innerHTML = html;
    return tempEl.firstElementChild;
  }
}

// const SOCKET_HOST = "ws://localhost:8899"; // WebSocket server URL
// const SOCKET_HOST = "ws://localhost:8080"; // WebSocket server URL
// let websocket;
// let retryInterval = 1000; // Initial retry interval in milliseconds
// const maxRetryInterval = 30000; // Maximum retry interval in milliseconds
// let retries = 0;
// const maxRetries = 10; // Maximum number of retry attempts

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
    console.log("[contentScript] Pending Requests : ", data); // Handle the data received from the server
    return data;
  } catch (error) {
    console.error(
      "[contentScript] There was a problem with the fetch operation:",
      error
    );
  }
}
/*
</consts_variables>
*/
// function connectWebSocket() {
//   console.log("[contentScript][Socket] calling connectWebSocket");
//   websocket = new WebSocket(SOCKET_HOST);

//   websocket.onopen = function () {
//     console.log("[Socket] [onopen]");
//     retries = 0; // Reset retry attempts upon successful connection
//   };

//   websocket.onmessage = function (event) {
//     console.log("[Socket] [onmessage]", event.data);
//     alert("File has been saved to vault");
//   };

//   websocket.onerror = function (error) {
//     console.error("[Socket] [onerror]", error);
//     reconnectWebSocket(); // Attempt to reconnect upon error
//   };

//   websocket.onclose = function (event) {
//     console.log("[Socket] [onclose]", event);
//     reconnectWebSocket(); // Attempt to reconnect upon close
//   };
// }

// function reconnectWebSocket() {
//   if (retries < maxRetries) {
//     retries++;
//     const nextRetryInterval = Math.min(retryInterval * 2, maxRetryInterval); // Exponential backoff strategy
//     // const nextRetryInterval = Math.min(nextRetryInterval); // Exponential backoff strategy
//     console.log(
//       `Attempting to reconnect in ${nextRetryInterval} milliseconds (attempt ${retries}/${maxRetries})...`
//     );
//     setTimeout(connectWebSocket, nextRetryInterval); // Retry after the next interval
//     retryInterval = nextRetryInterval;
//     // }
//     // else {
//     //   console.log(
//     //     "Maximum retry attempts reached. Could not establish WebSocket connection."
//     //   );
//     // }
//   }
// }

function getDocumentTypesUI() {
  let select = document.createElement("select");
  select.classList.add("tr__doc_types");
  for (var i = 0; i < documentTypes.length; i++) {
    var option = document.createElement("option");
    option.value = documentTypes[i].value;
    option.text = documentTypes[i].label;
    select.appendChild(option);
  }

  return select;
}

function getPendingRequestsUI(_filter) {
  console.log("FILTER  ", _filter);
  let requests = pendingRequests;
  console.log("TYPES  ", requests);
  if (_filter) {
    requests = requests.filter((r) => r.typeValue == _filter);
  }
  console.log("REQUESTS ", requests);

  /////
  /////

  // let __req = [
  //   {
  //     id: 1,
  //     startMonth: 1,
  //     startYear: 2024,
  //     endMonth: 6,
  //     endYear: 2024,
  //     requestingOrg: "ABC",
  //     type: "Utility Bills",
  //   },
  //   {
  //     id: 2,
  //     startMonth: 1,
  //     startYear: 2024,
  //     endMonth: 6,
  //     endYear: 2024,
  //     requestingOrg: "XYZ",
  //     type: "Utility Bills",
  //   },
  //   {
  //     id: 3,
  //     startMonth: 2,
  //     startYear: 2002,
  //     endMonth: null,
  //     endYear: null,
  //     requestingOrg: "ABC",
  //     type: "Utility Bills",
  //   },
  //   {
  //     id: 4,
  //     startMonth: 3,
  //     startYear: 2023,
  //     endMonth: null,
  //     endYear: null,
  //     requestingOrg: "XYZ",
  //     type: "Utility Bills",
  //   },
  //   {
  //     id: 5,
  //     startMonth: 4,
  //     startYear: 2024,
  //     endMonth: null,
  //     endYear: null,
  //     requestingOrg: "XYZ",
  //     type: "Pay Stubs",
  //   },
  // ];

  // requests = __req;
  let groupedRequests = groupObjectsByDate(requests);
  /////
  /////

  let elements = Object.keys(groupedRequests).map(function (grKey, index) {
    let requests = groupedRequests[grKey];
    let formattedOrgs = requests.map((r) => r.requestingOrg).join(", ");

    //
    //

    // return pr.type.map(function (prType) {
    // let pr = groupedRequests[pr];
    // let pr = req;
    // var prType = pr.type;
    // console.log("PENDING REQUEST ", pr);
    // console.log("PENDING REQUEST TYPE ", prType);
    // Create the main container div with class "tc__pr"
    const tcPrDiv = document.createElement("div");
    tcPrDiv.classList.add("tc__pr");

    // Create the div with class "tc__pr_headings"
    const tcPrHeadingsDiv = document.createElement("div");
    tcPrHeadingsDiv.classList.add("tc__pr_headings");

    // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
    // const tcPrRequestCodeDiv = document.createElement("div");
    // tcPrRequestCodeDiv.classList.add("tc__pr_req_code");
    // tcPrRequestCodeDiv.innerText = pr.code;
    // tcPrHeadingsDiv.appendChild(tcPrRequestCodeDiv);

    // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
    const tcPrOrgNameDiv = document.createElement("div");
    tcPrOrgNameDiv.classList.add("tc__pr_org_name");
    tcPrOrgNameDiv.innerText = `${grKey} (${formattedOrgs})`;
    tcPrHeadingsDiv.appendChild(tcPrOrgNameDiv);

    // Create the div with class "tc__pr_doc_type" and append it to "tc__pr_headings"
    // const tcPrDocTypeDiv = document.createElement("div");
    // tcPrDocTypeDiv.classList.add("tc__pr_doc_type");
    // let docType = types.find((t) => t.value == prType);
    // if (docType) {
    //   tcPrDocTypeDiv.innerText = docType.label;
    // }
    // tcPrHeadingsDiv.appendChild(tcPrDocTypeDiv);

    // Create the div with class "tc__pr_selection"
    const tcPrSelectionDiv = document.createElement("div");
    tcPrSelectionDiv.classList.add("tc__pr_selection");

    // Create the input element with type checkbox and append it to "tc__pr_selection"
    // const checkboxInput = document.createElement("input");
    // checkboxInput.setAttribute("type", "checkbox");
    // checkboxInput.setAttribute("class", "");
    // checkboxInput.setAttribute("data-id", "");
    const checkboxInput = tcDom.getRadio(null, index);
    // console.log("CHECKBOX ", checkboxInput);
    tcPrSelectionDiv.appendChild(checkboxInput);

    const trTitleWithCheckbox = document.createElement("div");
    trTitleWithCheckbox.classList.add("tc__pr_title");

    // Append "tc__pr_headings" and "tc__pr_selection" to the main container "tc__pr"
    trTitleWithCheckbox.appendChild(tcPrSelectionDiv);
    trTitleWithCheckbox.appendChild(tcPrHeadingsDiv);
    //
    tcPrDiv.appendChild(trTitleWithCheckbox);

    //
    //
    requests.forEach(function (request) {
      let docRequestContainer = document.createElement("div");
      docRequestContainer.classList.add("tc_abc");
      const docRequestCheckboxInput = tcDom.getCheckbox(
        request.type,
        request.id,
        index
      );
      docRequestContainer.appendChild(docRequestCheckboxInput);

      const docRequestOrg = document.createElement("div");
      docRequestOrg.innerHTML = request.requestingOrg;
      docRequestOrg.classList.add("tc_xyz");

      docRequestContainer.appendChild(docRequestCheckboxInput);
      docRequestContainer.appendChild(docRequestOrg);

      tcPrDiv.appendChild(docRequestContainer);
    });

    return tcPrDiv;
    // return requests.map(function (req) {
    //   // // return pr.type.map(function (prType) {
    //   // // let pr = groupedRequests[pr];
    //   // let pr = req;
    //   // var prType = pr.type;
    //   // console.log("PENDING REQUEST ", pr);
    //   // console.log("PENDING REQUEST TYPE ", prType);
    //   // // Create the main container div with class "tc__pr"
    //   // const tcPrDiv = document.createElement("div");
    //   // tcPrDiv.classList.add("tc__pr");
    //   // // Create the div with class "tc__pr_headings"
    //   // const tcPrHeadingsDiv = document.createElement("div");
    //   // tcPrHeadingsDiv.classList.add("tc__pr_headings");
    //   // // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
    //   // // const tcPrRequestCodeDiv = document.createElement("div");
    //   // // tcPrRequestCodeDiv.classList.add("tc__pr_req_code");
    //   // // tcPrRequestCodeDiv.innerText = pr.code;
    //   // // tcPrHeadingsDiv.appendChild(tcPrRequestCodeDiv);
    //   // // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
    //   // const tcPrOrgNameDiv = document.createElement("div");
    //   // tcPrOrgNameDiv.classList.add("tc__pr_org_name");
    //   // tcPrOrgNameDiv.innerText = `${grKey} (${pr.requestingOrg}, ${prType})`;
    //   // tcPrHeadingsDiv.appendChild(tcPrOrgNameDiv);
    //   // // Create the div with class "tc__pr_doc_type" and append it to "tc__pr_headings"
    //   // const tcPrDocTypeDiv = document.createElement("div");
    //   // tcPrDocTypeDiv.classList.add("tc__pr_doc_type");
    //   // let docType = types.find((t) => t.value == prType);
    //   // if (docType) {
    //   //   tcPrDocTypeDiv.innerText = docType.label;
    //   // }
    //   // tcPrHeadingsDiv.appendChild(tcPrDocTypeDiv);
    //   // // Create the div with class "tc__pr_selection"
    //   // const tcPrSelectionDiv = document.createElement("div");
    //   // tcPrSelectionDiv.classList.add("tc__pr_selection");
    //   // // Create the input element with type checkbox and append it to "tc__pr_selection"
    //   // // const checkboxInput = document.createElement("input");
    //   // // checkboxInput.setAttribute("type", "checkbox");
    //   // // checkboxInput.setAttribute("class", "");
    //   // // checkboxInput.setAttribute("data-id", "");
    //   // const checkboxInput = tcDom.getCheckbox(prType, pr.id);
    //   // // console.log("CHECKBOX ", checkboxInput);
    //   // tcPrSelectionDiv.appendChild(checkboxInput);
    //   // // Append "tc__pr_headings" and "tc__pr_selection" to the main container "tc__pr"
    //   // tcPrDiv.appendChild(tcPrSelectionDiv);
    //   // tcPrDiv.appendChild(tcPrHeadingsDiv);
    //   // return tcPrDiv;
    // });
  });

  // let elements = Object.keys(groupedRequests).map(function (gr) {
  //   // return pr.type.map(function (prType) {
  //   let pr = groupedRequests[pr];
  //   var prType = pr.type;
  //   console.log("PENDING REQUEST ", pr);
  //   console.log("PENDING REQUEST TYPE ", prType);
  //   // Create the main container div with class "tc__pr"
  //   const tcPrDiv = document.createElement("div");
  //   tcPrDiv.classList.add("tc__pr");

  //   // Create the div with class "tc__pr_headings"
  //   const tcPrHeadingsDiv = document.createElement("div");
  //   tcPrHeadingsDiv.classList.add("tc__pr_headings");

  //   // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
  //   // const tcPrRequestCodeDiv = document.createElement("div");
  //   // tcPrRequestCodeDiv.classList.add("tc__pr_req_code");
  //   // tcPrRequestCodeDiv.innerText = pr.code;
  //   // tcPrHeadingsDiv.appendChild(tcPrRequestCodeDiv);

  //   // Create the div with class "tc__pr_org_name" and append it to "tc__pr_headings"
  //   const tcPrOrgNameDiv = document.createElement("div");
  //   tcPrOrgNameDiv.classList.add("tc__pr_org_name");
  //   tcPrOrgNameDiv.innerText = `January 2024 (${pr.requestingOrg}, ${prType})`;
  //   tcPrHeadingsDiv.appendChild(tcPrOrgNameDiv);

  //   // Create the div with class "tc__pr_doc_type" and append it to "tc__pr_headings"
  //   const tcPrDocTypeDiv = document.createElement("div");
  //   tcPrDocTypeDiv.classList.add("tc__pr_doc_type");
  //   let docType = types.find((t) => t.value == prType);
  //   if (docType) {
  //     tcPrDocTypeDiv.innerText = docType.label;
  //   }
  //   tcPrHeadingsDiv.appendChild(tcPrDocTypeDiv);

  //   // Create the div with class "tc__pr_selection"
  //   const tcPrSelectionDiv = document.createElement("div");
  //   tcPrSelectionDiv.classList.add("tc__pr_selection");

  //   // Create the input element with type checkbox and append it to "tc__pr_selection"
  //   // const checkboxInput = document.createElement("input");
  //   // checkboxInput.setAttribute("type", "checkbox");
  //   // checkboxInput.setAttribute("class", "");
  //   // checkboxInput.setAttribute("data-id", "");
  //   const checkboxInput = tcDom.getCheckbox(prType, pr.id);
  //   // console.log("CHECKBOX ", checkboxInput);
  //   tcPrSelectionDiv.appendChild(checkboxInput);

  //   // Append "tc__pr_headings" and "tc__pr_selection" to the main container "tc__pr"
  //   tcPrDiv.appendChild(tcPrSelectionDiv);
  //   tcPrDiv.appendChild(tcPrHeadingsDiv);

  //   return tcPrDiv;
  //   // });
  // });

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
  // let icon_url = chrome.runtime.getURL("images/icon.png");
  let logo_url = chrome.runtime.getURL("images/logo.png");
  let upload_img_url = chrome.runtime.getURL("images/upload.png");
  let close_img_url = chrome.runtime.getURL("images/close.png");

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
      <div class="tc__modal_content">
        <!-- tc_modal_header START -->
        <div class="tc_modal_header tc_p-15">
          <div class="d-flex v-center">
            <!--<div>
              <img src="{icon_url}">
            </div>-->
            <div class="d-flex v-center">
              <div>
                <img src="${logo_url}" width="90%">
              </div>
            </div>
          </div>
        </div>
        <!-- tc_modal_header END --> 
        <!-- tc_modal_body START -->
        <div class="tc_modal_body tc_p-15">
          <div class="tc_download_info">
            Please download your requested documents
          </div>
          <span class="tc_control_label">Choose the file type</span>
          ${getDocumentTypesUI().outerHTML}
          <div class="tc__pending_req">
            <span class="tc_control_label">Choose the right request</span>  
              <div class="tc__pending_req_container"></div>
          </div>
        </div>
        <!-- tc_modal_body END -->
        <!-- tc_modal_foot START -->
        <div class="tc_modal_foot">
          <div class="d-flex h-center v-center">
            <button class="tc__btn" id="tc__close_modal"><img src='${close_img_url}' alt='close image' /> Decline</button>
            <button class="tc__btn" id="tc__save_to_vault"><img src='${upload_img_url}' alt='close image' /> Upload</button>
          </div>
          <div class="d-flex h-center h-center tc_p-15">
            <a href="https://www.google.com" target="_blank">View Dashboard</a>
          </div>
        </div>
        <!-- tc_modal_foot END -->
      </div>
  `;

  let shadowRoot = document.querySelector(".tc__host").shadowRoot;

  // Create a <link> element to link your CSS file
  const linkElement = document.createElement("link");
  linkElement.rel = "stylesheet";
  linkElement.type = "text/css";
  linkElement.href = `${chrome.runtime.getURL(
    "contentScript.css"
  )}?_t=${new Date().getTime()}`;

  // Inject the <link> element into the DOM
  shadowRoot.appendChild(linkElement);

  // let host = document.querySelector(".tc__host");
  // let root = host.attachShadow({ mode: "open" });
  // // appending to the shadow
  // root.textContent = "";
  shadowRoot.appendChild(tcModalDialog);

  // Append the modal dialog to the body
  // document.body.appendChild(tcModalDialog);

  // var checkboxes = shadowRoot.querySelectorAll(".tc__cb");
  // console.log("Checkboxes ", checkboxes.length);

  // for (let i = 0; i < checkboxes.length; i++) {
  //   checkboxes[i].removeEventListener("change");
  //   checkboxes[i].addEventListener("change", async function () {
  //     let type = this.getAttribute("data-req-type");
  //     let id = this.getAttribute("data-req-id");
  //     // tcDom.uncheckAllExceptOne(type, id);

  //     console.log("Is Checked ", this.checked);
  //     console.log("Is Checked ", this.getAttribute("data-req-type"));
  //     console.log("Is Checked ", this.getAttribute("data-req-id"));
  //   });
  // }

  shadowRoot
    .querySelector("#tc__save_to_vault")
    .addEventListener("click", async function () {
      let selections = tcDom.getSelectedOption();
      console.log("SELECTIONS ", selections);
      console.log("_reponsePayload ", _reponsePayload);
      if (selections.length == 0) {
        alert("Please select at least one request");
        return;
      }
      if (
        _reponsePayload.download.url &&
        _reponsePayload.download.url.startsWith("blob")
      ) {
        readFileFromServerAndUpload(_reponsePayload, selections);
        return;
      }

      _reponsePayload.selections = selections;
      _reponsePayload.saveToVault = true;

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

  shadowRoot
    .querySelector(".tr__doc_types")
    .addEventListener("change", async function () {
      let value = $(this).val();
      if (value) {
        let pendingRequestsDom = getPendingRequestsUI(value);
        console.log("GOT UI");
        shadowRoot.querySelector(".tc__pending_req_container").innerHTML =
          pendingRequestsDom.outerHTML;
        shadowRoot.querySelector(".tc__pending_req").classList.remove("d-none");
        subscribeToCheckBoxes();
      } else {
        shadowRoot.querySelector(".tc__pending_req_container").innerHTML = "";
        shadowRoot.querySelector(".tc__pending_req").classList.add("d-none");
      }
    });
}

function subscribeToCheckBoxes() {
  let shadowRoot = document.querySelector(".tc__host").shadowRoot;
  var checkboxes = shadowRoot.querySelectorAll(".tc__cb");
  console.log("Checkboxes ", checkboxes.length);

  for (let i = 0; i < checkboxes.length; i++) {
    // checkboxes[i].removeEventListener("change");
    checkboxes[i].addEventListener("change", function () {
      let type = this.getAttribute("data-req-type");
      let id = this.getAttribute("data-req-id");

      console.log("Is Checked ", this.checked);
      console.log("Is Checked ", this.getAttribute("data-req-type"));
      console.log("Is Checked ", this.getAttribute("data-req-id"));
    });
  }

  const radioButtons = shadowRoot.querySelectorAll('input[name="rad_request"]');
  console.log("Radio Buttons ", radioButtons.length);

  // Add event listener to each radio button
  radioButtons.forEach(function (radio) {
    radio.addEventListener("change", function () {
      // Event handler function
      console.log("Selected option: " + this.value);
      tcDom.toggleCheckboxes(this.value);
    });
  });
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
  if (!user || (user && Object.keys(user) == 0)) {
    return;
  }

  if (user.user) {
    let userObject = null;
    try {
      userObject = JSON.parse(user.user);
    } catch (err) {
      return;
    }

    let request = await getPendingRequests(userObject.access_token);
    if (request) {
      pendingRequests = request.requests;
      documentTypes = request.documentTypes;
      documentTypes.splice(0, 0, {
        label: "Choose Document Type",
        value: null,
      });
      // createModalDialog("Trusted Copy", null);
    }
    console.log("[contentScript] onRegister ", userObject);
  }

  let sDocTypes = await chrome.storage.local.get(["doc_types"]);
  if (sDocTypes.doc_types) {
    let types = JSON.parse(sDocTypes.doc_types);
    if (types) {
      documentTypes = types;
    }
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
          selections: [],
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
          alert("Failed to connect to Native Host");
        }
      } else if (request.action == ACTIONS.NATIVE_HOST_CONNECT) {
        if (!request.isConnected) {
          alert("Failed to connect to Native Host");
        } else {
          if (request.result && request.result.IsSuccess) {
            alert("File uploaded successfully");
          } else {
            alert("Failed to upload file | " + request.result.Message);
          }
        }
        let root = document.querySelector(".tc__host").shadowRoot;
        // appending to the shadow
        root.textContent = "";
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

  // createModalDialog("AA", null);
  // connectWebSocket();
}

function readFileFromServerAndUpload(_req, _selections) {
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
      console.log("[readFileFromServerAndUpload] BLOB DOWNLOAD with Success");
      // Upload the file to the destination server
      uploadFileToServer(DOC_SAVE_URL, fileBlob, _selections);
    })
    .catch((error) => {
      console.error("[readFileFromServerAndUpload] Error:", error);
      alert("Failed to download file");
    });
}

async function uploadFileToServer(destinationUrl, fileBlob, _selections) {
  console.log("CALLING [uploadFileToServer] ", _selections);
  // Create a FormData object and append the file blob to it
  var formdata = new FormData();
  formdata.append("source", "7B9LGYP3EK");
  formdata.append("local_ip", "127.0.0.1");
  formdata.append("public_ip", "10.10.10.10");
  formdata.append("local_datetime", "01/01/2023");
  formdata.append("timezone", "PKT");
  formdata.append("attachment", fileBlob, "document");
  for (var i = 0; i < _selections.length; i++) {
    let selection = _selections[i];
    formdata.append(`request[${i}]`, selection.requestId);
  }

  let user = await chrome.storage.local.get(["user"]);
  if (!user || (user && Object.keys(user) == 0)) {
    alert("Please login again");
    return;
  }

  let userObject = null;
  try {
    userObject = JSON.parse(user.user);
  } catch (err) {
    alert("Please login again");
    return;
  }

  // Make an HTTP request to upload the file to the destination server
  fetch(destinationUrl, {
    method: "POST",
    body: formdata,
    headers: {
      Authorization: `bearer ${userObject.access_token}`,
    },
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
