import React from "react";
import { CitizenHeader } from "../../../components/citizen/CitizenHeader";

interface Props {
  onBack: () => void;
  avatarLabel?: string;
}
export const ReportHeader = ({ onBack, avatarLabel = "EA" }: Props) => (
  <CitizenHeader
    title="Báo Cáo"
    onBack={onBack}
    avatarLabel={avatarLabel.slice(0, 2).toUpperCase()}
  />
);
