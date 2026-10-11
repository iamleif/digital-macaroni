"use client";

import { formfieldSample, lawfirmSample, northlineSample, travelSample } from "./live/sample-views";
import type { DemoId, FormFieldView, LawFirmView, NorthlineView, TravelView } from "./live/types";
import { FormFieldOffice, LawFirmOffice, NorthlineOffice, StaticPreview, TravelOffice } from "./demo/offices";
import d from "./demo/demo.module.css";

/**
 * The homepage examples show the real back office each demo uses, with its own sample records, scaled
 * down and held still. Nothing here is drawn by hand: if the demo changes, so does the example.
 */
export function LivePreview({ id }: { id: DemoId }) {
  const agent = "the agent";
  // The sample records name the fictional firm's partners and agent; the homepage shows no business names.
  const law = JSON.parse(JSON.stringify(lawfirmSample).replaceAll("Dana Alder", "Dana R.").replaceAll("Nora", "AI agent")) as LawFirmView;
  return <StaticPreview.Provider value>
    <div className={d.previewScope} aria-hidden="true" inert>
      {id === "northline" ? <NorthlineOffice view={northlineSample as NorthlineView} state="sample" agentName={agent} />
        : id === "formfield" ? <FormFieldOffice view={formfieldSample as FormFieldView} state="sample" agentName={agent} />
        : id === "lawfirm" ? <LawFirmOffice view={law} state="sample" agentName={agent} />
        : <TravelOffice view={travelSample as TravelView} state="sample" agentName={agent} />}
    </div>
  </StaticPreview.Provider>;
}
