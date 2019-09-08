// module stub to store common functions for ui editors
"use strict";

restoreDefaultEvents(); // apply default viewbox events on load

// restore default viewbox events
function restoreDefaultEvents() {
  svg.call(zoom);
  viewbox.style("cursor", "default")
    .on(".drag", null)
    .on("click", clicked)
    .on("touchmove mousemove", moved);
  legend.call(d3.drag().on("start", dragLegendBox));
}

// on viewbox click event - run function based on target
function clicked() {
  const el = d3.event.target; 
  if (!el || !el.parentElement || !el.parentElement.parentElement) return;
  const parent = el.parentElement, grand = parent.parentElement;
  if (parent.id === "rivers") editRiver(); else
  if (grand.id === "routes") editRoute(); else
  if (el.tagName === "tspan" && grand.parentNode.parentNode.id === "labels") editLabel(); else
  if (grand.id === "burgLabels") editBurg(); else
  if (grand.id === "burgIcons") editBurg(); else
  if (parent.id === "terrain") editReliefIcon(); else
  if (parent.id === "markers") editMarker();
}

// clear elSelected variable
function unselect() {
  restoreDefaultEvents();
  if (!elSelected) return;
  elSelected.call(d3.drag().on("drag", null)).attr("class", null);
  debug.selectAll("*").remove();
  viewbox.style("cursor", "default");
  elSelected = null;
}

// close all dialogs except stated
function closeDialogs(except = "#except") {
  $(".dialog:visible").not(except).each(function() {
    $(this).dialog("close");
  });
}

// move brush radius circle
function moveCircle(x, y, r = 20) {
  let circle = document.getElementById("brushCircle");
  if (!circle) {
    const html = `<circle id="brushCircle" cx=${x} cy=${y} r=${r}></circle>`;
    document.getElementById("debug").insertAdjacentHTML("afterBegin", html);
  } else {
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", r);
  }
}

function removeCircle() {
  if (document.getElementById("brushCircle")) document.getElementById("brushCircle").remove();
}

// get browser-defined fit-content
function fitContent() {
  return !window.chrome ? "-moz-max-content" : "fit-content";
}

// apply sorting behaviour for lines on Editor header click
document.querySelectorAll(".sortable").forEach(function(e) {
  e.addEventListener("click", function(e) {sortLines(this);});
});

function sortLines(header) {
  const type = header.classList.contains("alphabetically") ? "name" : "number";
  let order = header.className.includes("-down") ? "-up" : "-down";
  if (!header.className.includes("icon-sort") && type === "name") order = "-up";

  const headers = header.parentNode;
  headers.querySelectorAll("div.sortable").forEach(e => {
    e.classList.forEach(c => {if(c.includes("icon-sort")) e.classList.remove(c);});
  });
  header.classList.add("icon-sort-" + type + order);
  applySorting(headers);
}

function applySorting(headers) {
  const header = headers.querySelector("div[class*='icon-sort']");
  if (!header) return;
  const sortby = header.dataset.sortby;
  const name = header.classList.contains("alphabetically");
  const desc = header.className.includes("-down") ? -1 : 1;
  const list = headers.nextElementSibling;
  const lines = Array.from(list.children);

  lines.sort((a, b) => {
    const an = name ? a.dataset[sortby] : +a.dataset[sortby];
    const bn = name ? b.dataset[sortby] : +b.dataset[sortby];
    return (an > bn ? 1 : an < bn ? -1 : 0) * desc;
  }).forEach(line => list.appendChild(line));
}

// trigger trash button click on "Delete" keypress
function removeElementOnKey() {
  $(".dialog:visible .icon-trash").click();
  $("button:visible:contains('Remove')").click();
}

function addBurg(point) {
  const cells = pack.cells;
  const x = rn(point[0], 2), y = rn(point[1], 2);
  const cell = findCell(x, point[1]);
  const i = pack.burgs.length;
  const culture = cells.culture[cell];
  const name = Names.getCulture(culture);
  const state = cells.state[cell];
  const feature = cells.f[cell];

  const population = Math.max((cells.s[cell] + cells.road[cell]) / 3 + i / 1000 + cell % 100 / 1000, .1);
  pack.burgs.push({name, cell, x, y, state, i, culture, feature, capital: false, port: 0, population});
  cells.burg[cell] = i;

  const townSize = burgIcons.select("#towns").attr("size") || 0.5;
  burgIcons.select("#towns").append("circle").attr("id", "burg"+i).attr("data-id", i)
    .attr("cx", x).attr("cy", y).attr("r", townSize);
  burgLabels.select("#towns").append("text").attr("id", "burgLabel"+i).attr("data-id", i)
    .attr("x", x).attr("y", y).attr("dy", `${townSize * -1.5}px`).text(name);

  return i;
}

function moveBurgToGroup(id, g) {
  const label = document.querySelector("#burgLabels [data-id='" + id + "']");
  const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
  const anchor = document.querySelector("#anchors [data-id='" + id + "']");
  if (!label || !icon) {console.error("Cannot find label or icon elements"); return;}

  document.querySelector("#burgLabels > #"+g).appendChild(label);
  document.querySelector("#burgIcons > #"+g).appendChild(icon);

  const iconSize = icon.parentNode.getAttribute("size");
  icon.setAttribute("r", iconSize);
  label.setAttribute("dy", `${iconSize * -1.5}px`);

  if (anchor) {
    document.querySelector("#anchors > #"+g).appendChild(anchor);
    const anchorSize = +anchor.parentNode.getAttribute("size");
    anchor.setAttribute("width", anchorSize);
    anchor.setAttribute("height", anchorSize);
    anchor.setAttribute("x", rn(pack.burgs[id].x - anchorSize * 0.47, 2));
    anchor.setAttribute("y", rn(pack.burgs[id].y - anchorSize * 0.47, 2));
  }
}

function removeBurg(id) {
  const label = document.querySelector("#burgLabels [data-id='" + id + "']");
  const icon = document.querySelector("#burgIcons [data-id='" + id + "']");
  const anchor = document.querySelector("#anchors [data-id='" + id + "']");
  if (label) label.remove();
  if (icon) icon.remove();
  if (anchor) anchor.remove();
  pack.burgs[id].removed = true;
  const cell = pack.burgs[id].cell;
  pack.cells.burg[cell] = 0;
}

// draw legend box
function drawLegend(name, data) {
  legend.selectAll("*").remove(); // fully redraw every time
  legend.attr("data", data.join("|")); // store data

  const itemsInCol = +styleLegendColItems.value;
  const fontSize = +legend.attr("font-size");
  const backClr = styleLegendBack.value;
  const opacity = +styleLegendOpacity.value;

  const lineHeight = Math.round(fontSize * 1.7);
  const colorBoxSize = Math.round(fontSize / 1.7);
  const colOffset = fontSize;
  const vOffset = fontSize / 2;

  // append items
  const boxes = legend.append("g").attr("stroke-width", .5).attr("stroke", "#111111").attr("stroke-dasharray", "none");
  const labels = legend.append("g").attr("fill", "#000000").attr("stroke", "none");

  const columns = Math.ceil(data.length / itemsInCol);
  for (let column=0, i=0; column < columns; column++) {
    const linesInColumn = Math.ceil(data.length / columns);
    const offset = column ? colOffset * 2 + legend.node().getBBox().width : colOffset;

    for (let l=0; l < linesInColumn && data[i]; l++, i++) {
      boxes.append("rect").attr("fill", data[i][1])
        .attr("x", offset).attr("y", lineHeight + l*lineHeight + vOffset)
        .attr("width", colorBoxSize).attr("height", colorBoxSize);

      labels.append("text").text(data[i][2])
        .attr("x", offset + colorBoxSize * 1.6).attr("y", fontSize/1.6 + lineHeight + l*lineHeight + vOffset);
    }
  }

  // append label
  const offset = colOffset + legend.node().getBBox().width / 2;
  labels.append("text")
    .attr("text-anchor", "middle").attr("font-weight", "bold").attr("font-size", "1.2em")
    .attr("id", "legendLabel").text(name).attr("x", offset).attr("y", fontSize * 1.1 + vOffset / 2);

  // append box
  const bbox = legend.node().getBBox();
  const width = bbox.width + colOffset * 2;
  const height = bbox.height + colOffset / 2 + vOffset;

  legend.insert("rect", ":first-child").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height)
    .attr("fill", backClr).attr("fill-opacity", opacity);

  fitLegendBox();
}

// fit Legend box to map size
function fitLegendBox() {
  if (!legend.selectAll("*").size()) return;
  const px = isNaN(+legend.attr("data-x")) ? 99 : legend.attr("data-x") / 100;
  const py = isNaN(+legend.attr("data-y")) ? 93 : legend.attr("data-y") / 100;
  const bbox = legend.node().getBBox();
  const x = rn(svgWidth * px - bbox.width), y = rn(svgHeight * py - bbox.height);
  legend.attr("transform", `translate(${x},${y})`);
}

// draw legend with the same data, but using different settings
function redrawLegend() {
  const name = legend.select("#legendLabel").text();
  const data = legend.attr("data").split("|").map(l => l.split(","));
  drawLegend(name, data);
}

function dragLegendBox() {
  const tr = parseTransform(this.getAttribute("transform"));
  const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;
  const bbox = legend.node().getBBox();

  d3.event.on("drag", function() {
    const px = rn((x + d3.event.x + bbox.width) / svgWidth * 100, 2);
    const py = rn((y + d3.event.y + bbox.height) / svgHeight * 100, 2);
    const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
    legend.attr("transform", transform).attr("data-x", px).attr("data-y", py);
  });
}

function clearLegend() {
  legend.selectAll("*").remove();
  legend.attr("data", null);
}

// draw color (fill) picker
function createPicker() {
  const pos = () => tip("Drag to change the picker position");
  const cl = () => tip("Click to close the picker");
  const closePicker = () => contaiter.style("display", "none");

  const contaiter = d3.select("body").append("svg").attr("id", "pickerContainer").attr("width", "100%").attr("height", "100%");
  contaiter.append("rect").attr("x", 0).attr("y", 0).attr("width", "100%").attr("height", "100%").attr("opacity", .2)
    .on("mousemove", cl).on("click", closePicker);
  const picker = contaiter.append("g").attr("id", "picker").call(d3.drag().on("start", dragPicker));

  const controls = picker.append("g").attr("id", "pickerControls");
  const h = controls.append("g");
  h.append("text").attr("x", 4).attr("y", 14).text("H:");
  h.append("line").attr("x1", 18).attr("y1", 10).attr("x2", 107).attr("y2", 10);
  h.append("circle").attr("cx", 75).attr("cy", 10).attr("r", 5).attr("id", "pickerH");
  h.on("mousemove", () => tip("Set palette hue"));

  const s = controls.append("g");
  s.append("text").attr("x", 113).attr("y", 14).text("S:");
  s.append("line").attr("x1", 124).attr("y1", 10).attr("x2", 206).attr("y2", 10)
  s.append("circle").attr("cx", 181.4).attr("cy", 10).attr("r", 5).attr("id", "pickerS");
  s.on("mousemove", () => tip("Set palette saturation"));

  const l = controls.append("g");
  l.append("text").attr("x", 213).attr("y", 14).text("L:");
  l.append("line").attr("x1", 226).attr("y1", 10).attr("x2", 306).attr("y2", 10);
  l.append("circle").attr("cx", 282).attr("cy", 10).attr("r", 5).attr("id", "pickerL");
  l.on("mousemove", () => tip("Set palette lightness"));

  controls.selectAll("line").on("click", clickPickerControl);
  controls.selectAll("circle").call(d3.drag().on("start", dragPickerControl));

  const spaces = picker.append("foreignObject").attr("id", "pickerSpaces")
    .attr("x", 4).attr("y", 20).attr("width", 303).attr("height", 20)
    .on("mousemove", () => tip("Color value in different color spaces. Edit to change"));
  const html = `
  <label style="margin-right: 6px">HSL: 
    <input type="number" id="pickerHSL_H" data-space="hsl" min=0 max=360 value="231">,
    <input type="number" id="pickerHSL_S" data-space="hsl" min=0 max=100 value="70">, 
    <input type="number" id="pickerHSL_L" data-space="hsl" min=0 max=100 value="70">
  </label>
  <label style="margin-right: 6px">RGB: 
    <input type="number" id="pickerRGB_R" data-space="rgb" min=0 max=255 value="125">,
    <input type="number" id="pickerRGB_G" data-space="rgb" min=0 max=255 value="142">, 
    <input type="number" id="pickerRGB_B" data-space="rgb" min=0 max=255 value="232">
  </label>
  <label>HEX: <input type="text" id="pickerHEX"  data-space="hex" style="width:42px" autocorrect="off" spellcheck="false" value="#7d8ee8"></label>`;
  spaces.node().insertAdjacentHTML('beforeend', html);
  spaces.selectAll("input").on("change", changePickerSpace);

  const colors = picker.append("g").attr("id", "pickerColors").attr("stroke", "#333333");
  const hatches = picker.append("g").attr("id", "pickerHatches").attr("stroke", "#333333");
  const hatching = d3.selectAll("g#hatching > pattern");
  const number = hatching.size();

  const clr = d3.range(number).map(i => d3.hsl(i/number*360, .7, .7).hex());
  clr.forEach(function(d, i) {
    colors.append("rect").attr("id", "picker_" + d).attr("fill", d).attr("class", i?"":"selected")
      .attr("x", i*22+4).attr("y", 40).attr("width", 16).attr("height", 16);
  });

  hatching.each(function(d, i) {
    hatches.append("rect").attr("id", "picker_" + this.id).attr("fill", "url(#" + this.id + ")")
      .attr("x", i*22+4).attr("y", 61).attr("width", 16).attr("height", 16);
  });

  colors.selectAll("rect").on("click", pickerFillClicked).on("mousemove", () => tip("Click to fill with the color"));
  hatches.selectAll("rect").on("click", pickerFillClicked).on("mousemove", () => tip("Click to fill with the hatching"));

  // append box
  const bbox = picker.node().getBBox();
  const width = bbox.width + 8;
  const height = bbox.height + 9;

  picker.insert("rect", ":first-child").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height).attr("fill", "#ffffff").attr("stroke", "#5d4651").on("mousemove", pos);
  picker.insert("text", ":first-child").attr("x", 291).attr("y", -11).attr("id", "pickerCloseText").text("✖");
  picker.insert("rect", ":first-child").attr("x", 288).attr("y", -21).attr("id", "pickerCloseRect").attr("width", 14).attr("height", 14).on("mousemove", cl).on("click", closePicker);
  picker.insert("text", ":first-child").attr("x", 12).attr("y", -10).attr("id", "pickerLabel").text("Color Picker").on("mousemove", pos);
  picker.insert("rect", ":first-child").attr("x", 0).attr("y", -30).attr("width", width).attr("height", 30).attr("id", "pickerHeader").on("mousemove", pos);
  picker.attr("transform", `translate(${(svgWidth-width)/2},${(svgHeight-height)/2})`);
}

function updateSelectedRect(fill) {
  document.getElementById("picker").querySelector("rect.selected").classList.remove("selected");
  document.getElementById("picker").querySelector("rect[fill='"+fill+"']").classList.add("selected");
}

function updateSpaces() {
  // hsl
  const h = getPickerControl(pickerH, 360);
  const s = getPickerControl(pickerS, 1);
  const l = getPickerControl(pickerL, 1);
  pickerHSL_H.value = rn(h);
  pickerHSL_S.value = rn(s * 100); // multiplied by 100
  pickerHSL_L.value = rn(l * 100); // multiplied by 100

  // rgb
  const rgb = d3.color(d3.hsl(h, s, l));
  pickerRGB_R.value = rgb.r;
  pickerRGB_G.value = rgb.g;
  pickerRGB_B.value = rgb.b;

  // hex
  pickerHEX.value = rgb.hex();
}

function updatePickerColors() {
  const colors = d3.select("#picker > #pickerColors").selectAll("rect");
  const number = colors.size();

  const h = getPickerControl(pickerH, 360);
  const s = getPickerControl(pickerS, 1);
  const l = getPickerControl(pickerL, 1);

  colors.each(function(d, i) {
    const clr = d3.hsl(i/number*180+h, s, l).hex();
    this.setAttribute("id", "picker_" + clr);
    this.setAttribute("fill", clr);
  });
}

function openPicker(fill, callback) {
  const picker = d3.select("#picker");
  if (!picker.size()) createPicker();
  d3.select("#pickerContainer").style("display", "block");

  if (fill[0] === "#") {
    const hsl = d3.hsl(fill);
    if (!isNaN(hsl.h)) setPickerControl(pickerH, hsl.h, 360);
    if (!isNaN(hsl.s)) setPickerControl(pickerS, hsl.s, 1);
    if (!isNaN(hsl.l)) setPickerControl(pickerL, hsl.l, 1);
    updateSpaces();
    updatePickerColors();
  }

  updateSelectedRect(fill);

  openPicker.updateFill = function() {
    const selected = document.getElementById("picker").querySelector("rect.selected");
    if (!selected) return;
    callback(selected.getAttribute("fill"));
  }
}

function setPickerControl(control, value, max) {
  const min = +control.previousSibling.getAttribute("x1");
  const delta = +control.previousSibling.getAttribute("x2") - min;
  const percent = value / max;
  control.setAttribute("cx", min + delta * percent);
}

function getPickerControl(control, max) {
  const min = +control.previousSibling.getAttribute("x1");
  const delta = +control.previousSibling.getAttribute("x2") - min;
  const current = +control.getAttribute("cx") - min;
  return current / delta * max;
}

function dragPicker() {
  const tr = parseTransform(this.getAttribute("transform"));
  const x = +tr[0] - d3.event.x, y = +tr[1] - d3.event.y;
  const picker = d3.select("#picker");
  const bbox = picker.node().getBBox();

  d3.event.on("drag", function() {
    const px = rn((x + d3.event.x + bbox.width) / svgWidth * 100, 2);
    const py = rn((y + d3.event.y + bbox.height) / svgHeight * 100, 2);
    const transform = `translate(${(x + d3.event.x)},${(y + d3.event.y)})`;
    picker.attr("transform", transform).attr("data-x", px).attr("data-y", py);
  });
}

function pickerFillClicked() {
  const fill = this.getAttribute("fill");
  updateSelectedRect(fill);
  openPicker.updateFill();

  const hsl = d3.hsl(fill);
  if (isNaN(hsl.h)) return; // not a color
  setPickerControl(pickerH, hsl.h, 360);
  updateSpaces();
}

function clickPickerControl() {
  const min = this.getScreenCTM().e;
  this.nextSibling.setAttribute("cx", d3.event.x - min);
  updateSpaces();
  updatePickerColors();
  openPicker.updateFill();
}

function dragPickerControl() {
  const min = +this.previousSibling.getAttribute("x1");
  const max = +this.previousSibling.getAttribute("x2");

  d3.event.on("drag", function() {
    const x = Math.max(Math.min(d3.event.x, max), min);
    this.setAttribute("cx", x);
    updateSpaces();
    updatePickerColors();
    openPicker.updateFill();
  });
}

function changePickerSpace() {
  const valid = this.checkValidity();
  if (!valid) {tip("You must provide a correct value", false, "error"); return;}

  const space = this.dataset.space;
  const i = Array.from(this.parentNode.querySelectorAll("input")).map(input => input.value); // inputs
  const fill = space === "hex" ? d3.rgb(this.value) 
    : space === "rgb" ? d3.rgb(i[0], i[1], i[2]) 
    : d3.hsl(i[0], i[1]/100, i[2]/100);

  const hsl = d3.hsl(fill);
  if (isNaN(hsl.l)) {tip("You must provide a correct value", false, "error"); return;}
  if (!isNaN(hsl.h)) setPickerControl(pickerH, hsl.h, 360);
  if (!isNaN(hsl.s)) setPickerControl(pickerS, hsl.s, 1);
  if (!isNaN(hsl.l)) setPickerControl(pickerL, hsl.l, 1);

  updateSpaces();
  updatePickerColors();
  openPicker.updateFill();
}

// remove all fogging
function unfog() {
  defs.select("#fog").selectAll("path").remove();
  fogging.selectAll("path").remove();
  fogging.attr("display", "none");
}